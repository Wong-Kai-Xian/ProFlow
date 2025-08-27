import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

let zoomClient = null;
let initPromise = null;
let joinPromise = null;
let isInitialized = false;
let activeMeetingNumber = null;
let zoomRootEl = null;
let errorHandlerBound = false;
let isJoined = false;

export const getZoomClient = () => {
	if (!zoomClient) {
		zoomClient = ZoomMtgEmbedded.createClient();
	}
	return zoomClient;
};

export const initializeAndJoinZoom = async ({
	rootElement,
	meetingNumber,
	passcode,
	userName,
	role = 0
}) => {
	const client = getZoomClient();
	// Initialize once per page container; if container changes, attempt re-init
	if (!isInitialized || zoomRootEl !== rootElement) {
		if (!initPromise) {
			const rect = rootElement?.getBoundingClientRect?.() || { width: 800, height: 600 };
			const widthPx = Math.max(1, Math.floor(rect.width));
			const heightPx = Math.max(1, Math.floor(rect.height));
			initPromise = client.init({
				zoomAppRoot: rootElement,
				language: 'en-US',
				patchJsMedia: true,
				customize: {
					video: {
						viewSizes: { default: { width: `${widthPx}px`, height: `${heightPx}px` } }
					}
				}
			}).then(() => {
				isInitialized = true; zoomRootEl = rootElement;
				if (!errorHandlerBound) {
					try {
						client.on('error', (err) => { try { console.warn('Zoom SDK error', err); } catch {} });
					} catch {}
					errorHandlerBound = true;
				}
			}).catch((e) => { isInitialized = false; zoomRootEl = null; throw e; }).finally(() => { initPromise = null; });
		}
		await initPromise;
	}

	// If already in this meeting, do nothing
	if (activeMeetingNumber && String(activeMeetingNumber) === String(meetingNumber)) {
		return client;
	}

	// Avoid duplicated join calls
	if (joinPromise) {
		return joinPromise;
	}

	joinPromise = (async () => {
		// Obtain signature from backend
		const sigResp = await fetch('/api/zoom/signature', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ meetingNumber, role })
		});
		if (!sigResp.ok) {
			throw new Error('Failed to get Zoom signature');
		}
		const { signature, sdkKey } = await sigResp.json();
		await client.join({
			sdkKey,
			signature,
			meetingNumber,
			password: passcode || '',
			userName: userName || 'Guest'
		});
		activeMeetingNumber = String(meetingNumber);
		isJoined = true;
		return client;
	})()
		.finally(() => { joinPromise = null; });

	return joinPromise;
};

export const leaveZoomIfJoined = async () => {
	try {
		const client = getZoomClient();
		await client.leave();
		isJoined = false;
		activeMeetingNumber = null;
	} catch {}
};

export const destroyZoomClient = async () => {
	try {
		const client = getZoomClient();
		try { await client.leave(); } catch {}
		try { if (typeof client.destroy === 'function') { await client.destroy(); } } catch {}
	} catch {}
	zoomClient = null;
	initPromise = null;
	joinPromise = null;
	isInitialized = false;
	activeMeetingNumber = null;
	zoomRootEl = null;
	errorHandlerBound = false;
	isJoined = false;
};

export const getZoomJoinState = () => ({ isJoined, activeMeetingNumber });


