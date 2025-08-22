import React, { useState, useEffect } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from "../profile-component/constants";
import { db, storage } from '../../firebase'; // Import db and storage
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Import Storage functions

export default function SendApprovalModal({
  isOpen,
  onClose,
  onSendApproval,
  defaultProject = null,
  defaultStatus = "",
  currentUser, // Expect currentUser prop
}) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState("all"); // Initialize with "all" for all admins by default
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [admins, setAdmins] = useState([]); // State to store fetched admins
  const [loading, setLoading] = useState(false); // New loading state
  const [uploadProgress, setUploadProgress] = useState(0); // For file upload progress
  const [uploading, setUploading] = useState(false); // For file upload status

  useEffect(() => {
    if (!isOpen) return;

    const fetchAdmins = async () => {
      const adminsCollectionRef = collection(db, "users");
      // Assuming "role" field exists and identifies admins
      const q = query(adminsCollectionRef, where("role", "==", "admin"));
      const querySnapshot = await getDocs(q);
      const adminList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdmins(adminList);
      // If there are admins, set the default selected admin to the first one, or "all" if it's the default.
      // If no admins, selectedAdmin remains "all" or can be set to ""
      if (adminList.length > 0 && selectedAdmin === "") { // Only set default if no specific admin selected
        setSelectedAdmin("all"); // Default to all if no other selection has been made
      }
    };

    fetchAdmins();
  }, [isOpen]);

  console.log("Admins fetched:", admins);
  console.log("Admins length:", admins.length);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    console.log("handleSubmit called.");
    if (!message.trim() && !file) {
      alert("Please enter a message or upload a file.");
      return;
    }
    // No longer need this check if "all" is a valid option
    // if (!selectedAdmin) {
    //   alert("Please select an admin to send the approval to.");
    //   return;
    // }

    setLoading(true);
    let fileUrl = "";

    if (file) {
      console.log("File detected, starting upload.");
      setUploading(true);
      const storageRef = ref(storage, `approval_files/${file.name}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          console.error("File upload error:", error);
          alert("Failed to upload file.");
          setLoading(false);
          setUploading(false);
          // It's important to return here or handle the error properly
        },
        async () => {
          console.log("File upload complete.");
          fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("File URL:", fileUrl);
          await saveApprovalRequest(fileUrl);
          setUploading(false);
          setLoading(false);
          onClose();
        }
      );
    } else {
      console.log("No file to upload, saving approval request directly.");
      await saveApprovalRequest(fileUrl);
      setLoading(false);
      onClose();
    }
  };

  const saveApprovalRequest = async (fileUrl) => {
    console.log("saveApprovalRequest called with fileUrl:", fileUrl);
    try {
      const requests = [];
      if (selectedAdmin === "all") {
        console.log("Sending to all admins.");
        if (admins.length === 0) {
          alert("No admins available to send approval requests to.");
          return;
        }
        // Send to all admins
        for (const admin of admins) {
          console.log("Adding request for admin:", admin.id);
          requests.push(addDoc(collection(db, "approvalRequests"), {
            projectId: defaultProject ? defaultProject.id : null,
            projectName: defaultProject ? defaultProject.name : "",
            status: "pending",
            message: message.trim(),
            fileUrl: fileUrl,
            fileName: file ? file.name : "",
            requestedBy: currentUser ? currentUser.id : "anonymous",
            requestedByName: currentUser ? currentUser.name : "Anonymous",
            requestedTo: admin.id,
            requestedToName: admin.name,
            timestamp: serverTimestamp(),
          }));
        }
      } else {
        console.log("Sending to specific admin:", selectedAdmin);
        // Send to a specific admin
        const selectedAdminData = admins.find(admin => admin.id === selectedAdmin);
        if (!selectedAdminData) {
          alert("Selected admin not found.");
          return;
        }
        requests.push(addDoc(collection(db, "approvalRequests"), {
          projectId: defaultProject ? defaultProject.id : null,
          projectName: defaultProject ? defaultProject.name : "",
          status: "pending",
          message: message.trim(),
          fileUrl: fileUrl,
          fileName: file ? file.name : "",
          requestedBy: currentUser ? currentUser.id : "anonymous",
          requestedByName: currentUser ? currentUser.name : "Anonymous",
          requestedTo: selectedAdminData.id,
          requestedToName: selectedAdminData.name,
          timestamp: serverTimestamp(),
        }));
      }
      console.log("Awaiting all approval requests to complete.");
      await Promise.all(requests); // Wait for all requests to complete
      console.log("Approval request(s) sent successfully.");

      if (onSendApproval) {
        onSendApproval(); 
      }
      setMessage("");
      setFile(null);
      setSelectedAdmin("all"); // Reset selected admin to "all"
    } catch (error) {
      console.error("Error sending approval request(s):", error);
      alert("Failed to send approval request(s).");
    }
  };

  if (!isOpen) return null;

  console.log("SendApprovalModal is open. Current selectedAdmin:", selectedAdmin);
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        padding: "30px",
        borderRadius: LAYOUT.borderRadius,
        width: "95%",
        maxWidth: "800px",
        maxHeight: "95vh",
        overflowY: "auto",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.2)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}>
        <h2 style={{ margin: 0, color: COLORS.dark, fontSize: "22px", marginBottom: "15px" }}>Send Approval</h2>
        
        {/* Admin selection dropdown */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Send to Admin:</label>
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              padding: "12px",
              fontSize: "15px",
            }}
            disabled={loading || uploading}
          >
            <option value="all">All Admins</option> {/* Added "All Admins" option */}
            {admins.length === 0 && selectedAdmin !== "all" && <option value="">No Admins Available</option>}
            {admins.map(admin => (
              <option key={admin.id} value={admin.id}>{admin.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your approval message..."
            rows="7"
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              resize: "vertical",
              minHeight: "120px",
              padding: "12px",
              fontSize: "15px",
            }}
            disabled={loading || uploading}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Upload File:</label>
          <input
            type="file"
            onChange={handleFileChange}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              padding: "12px",
              border: `1px solid ${COLORS.border}`,
              fontSize: "15px",
            }}
            disabled={loading || uploading}
          />
          {uploading && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: COLORS.primary }}>
              Uploading: {uploadProgress.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Moved Send Approval and Cancel buttons to the bottom */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px", marginTop: "20px" }}>
          <button
            onClick={onClose}
            style={{ ...BUTTON_STYLES.secondary, padding: "12px 25px", fontSize: "15px" }}
            disabled={loading || uploading}
          >
            Cancel
          </button>
          <button
            onClick={() => { console.log("Send Approval button clicked."); setShowConfirmationModal(true); }}
            style={{ ...BUTTON_STYLES.primary, padding: "12px 25px", fontSize: "15px" }}
            disabled={loading || uploading || (selectedAdmin === "all" && admins.length === 0)} // Disable if "all" is selected and no admins are available
          >
            {loading ? 'Sending...' : 'Send Approval'}
          </button>
        </div>

        {/* Confirmation Modal */}
        {showConfirmationModal && (
          <>
            {console.log("Confirmation Modal is being rendered.")}
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1001,
            }}>
              <div style={{
                backgroundColor: COLORS.white,
                padding: "30px",
                borderRadius: LAYOUT.borderRadius,
                width: "90%",
                maxWidth: "400px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                textAlign: "center",
              }}>
                <h3 style={{ margin: 0, color: COLORS.dark }}>Confirm Send Approval</h3>
                <p style={{ margin: 0, color: COLORS.text }}>Are you sure you want to send this approval?</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "10px" }}>
                  <button
                    onClick={() => { console.log("Confirmation Cancel clicked."); setShowConfirmationModal(false); }}
                    style={{ ...BUTTON_STYLES.secondary, padding: "10px 20px", fontSize: "14px" }}
                    disabled={loading || uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { console.log("Confirmation Confirm clicked, calling handleSubmit."); handleSubmit(); setShowConfirmationModal(false); }} // Proceed with submission
                    style={{ ...BUTTON_STYLES.primary, padding: "10px 20px", fontSize: "14px" }}
                    disabled={loading || uploading}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
