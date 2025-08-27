require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetchFn = (typeof fetch !== 'undefined' && fetch) || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const app = express();
app.use(express.json());
app.use(cors());

// Health check
app.get('/api/health', (_req, res) => {
	res.json({ ok: true, service: 'zoom-backend' });
});

// Generate Zoom Meeting SDK signature
// Expects: { meetingNumber: string|number, role: 0|1 }
app.post('/api/zoom/signature', (req, res) => {
	try {
		const { meetingNumber, role } = req.body || {};
		const sdkKey = process.env.ZOOM_SDK_KEY;
		const sdkSecret = process.env.ZOOM_SDK_SECRET;
		if (!sdkKey || !sdkSecret) {
			return res.status(500).json({ error: 'Missing ZOOM_SDK_KEY or ZOOM_SDK_SECRET' });
		}
		if (!meetingNumber && meetingNumber !== 0) {
			return res.status(400).json({ error: 'meetingNumber required' });
		}
		const roleNum = typeof role === 'number' ? role : 0;
		const iat = Math.floor(Date.now() / 1000) - 30; // issue 30s in the past to allow clock skew
		const exp = iat + 60 * 60 * 2; // 2 hours
		const payload = {
			sdkKey,
			mn: String(meetingNumber),
			role: roleNum,
			iat,
			exp,
			appKey: sdkKey,
			tokenExp: exp
		};
		const signature = jwt.sign(payload, sdkSecret, { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } });
		return res.json({ signature, sdkKey });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to generate signature' });
	}
});

// Create a Zoom meeting via Server-to-Server OAuth
// Expects: { topic?: string, duration?: number, settings?: object }
app.post('/api/zoom/meetings', async (req, res) => {
	try {
		const { topic = 'ProFlow Meeting', duration = 60, settings = {} } = req.body || {};
		const accountId = process.env.ZOOM_ACCOUNT_ID;
		const clientId = process.env.ZOOM_CLIENT_ID;
		const clientSecret = process.env.ZOOM_CLIENT_SECRET;
		if (!accountId || !clientId || !clientSecret) {
			return res.status(500).json({ error: 'Missing Zoom Server-to-Server OAuth credentials' });
		}
		// Get access token
		const tokenResp = await fetchFn(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
			method: 'POST',
			headers: {
				Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
			}
		});
		if (!tokenResp.ok) {
			const errText = await tokenResp.text();
			return res.status(500).json({ error: 'Failed to obtain Zoom access token', details: errText });
		}
		const tokenData = await tokenResp.json();
		const accessToken = tokenData.access_token;
		// Create a scheduled meeting with join_before_host enabled
		const body = {
			topic,
			type: 2, // scheduled
			start_time: new Date().toISOString(),
			duration,
			settings: {
				join_before_host: true,
				waiting_room: false,
				participant_video: true,
				host_video: false,
				...settings
			}
		};
		const meetingResp = await fetchFn('https://api.zoom.us/v2/users/me/meetings', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		if (!meetingResp.ok) {
			const errText = await meetingResp.text();
			return res.status(500).json({ error: 'Failed to create Zoom meeting', details: errText });
		}
		const data = await meetingResp.json();
		return res.json({
			meetingNumber: String(data.id),
			passcode: data.password || '',
			join_url: data.join_url || '',
			start_url: data.start_url || ''
		});
	} catch (e) {
		return res.status(500).json({ error: 'Failed to create meeting' });
	}
});

// End a Zoom meeting (host action). Requires Server-to-Server OAuth.
app.post('/api/zoom/meetings/:id/end', async (req, res) => {
	try {
		const meetingId = req.params.id;
		const accountId = process.env.ZOOM_ACCOUNT_ID;
		const clientId = process.env.ZOOM_CLIENT_ID;
		const clientSecret = process.env.ZOOM_CLIENT_SECRET;
		if (!accountId || !clientId || !clientSecret) {
			return res.status(500).json({ error: 'Missing Zoom Server-to-Server OAuth credentials' });
		}
		const tokenResp = await fetchFn(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
			method: 'POST',
			headers: {
				Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
			}
		});
		if (!tokenResp.ok) {
			const errText = await tokenResp.text();
			return res.status(500).json({ error: 'Failed to obtain Zoom access token', details: errText });
		}
		const tokenData = await tokenResp.json();
		const accessToken = tokenData.access_token;
		const endResp = await fetchFn(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/status`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ action: 'end' })
		});
		if (!endResp.ok) {
			const errText = await endResp.text();
			return res.status(500).json({ error: 'Failed to end meeting', details: errText });
		}
		return res.json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to end meeting' });
	}
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`[zoom-backend] listening on http://localhost:${PORT}`);
});


