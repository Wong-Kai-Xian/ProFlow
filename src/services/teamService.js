import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * Get accepted team members for the current user
 * This includes:
 * 1. Users who accepted invitations from current user
 * 2. Users whose invitations the current user accepted
 */
export const getAcceptedTeamMembers = async (currentUser) => {
  if (!currentUser) return [];

  try {
    const acceptedMembers = new Map(); // Use Map to avoid duplicates

    // 1. Get users who accepted invitations FROM current user
    const outgoingInvitationsQuery = query(
      collection(db, "invitations"),
      where("fromUserId", "==", currentUser.uid),
      where("status", "==", "accepted")
    );
    const outgoingSnapshot = await getDocs(outgoingInvitationsQuery);
    
    for (const invitationDoc of outgoingSnapshot.docs) {
      const invitationData = invitationDoc.data();
      try {
        // Find user by email
        const usersQuery = query(
          collection(db, "users"),
          where("email", "==", invitationData.toUserEmail)
        );
        const userSnapshot = await getDocs(usersQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          const userId = userData.uid || userSnapshot.docs[0].id;
          acceptedMembers.set(userId, {
            id: userId,
            name: userData.name || userData.email || 'Team Member',
            email: userData.email,
            invitationStatus: 'accepted_outgoing',
            acceptedAt: invitationData.acceptedAt
          });
        }
      } catch (error) {
        console.error("Error fetching outgoing invitation user:", error);
      }
    }

    // 2. Get users whose invitations the current user accepted (incoming)
    const incomingInvitationsQuery = query(
      collection(db, "invitations"),
      where("toUserEmail", "==", currentUser.email),
      where("status", "==", "accepted")
    );
    const incomingSnapshot = await getDocs(incomingInvitationsQuery);
    
    for (const invitationDoc of incomingSnapshot.docs) {
      const invitationData = invitationDoc.data();
      try {
        const userRef = doc(db, "users", invitationData.fromUserId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userId = userData.uid || userDoc.id;
          acceptedMembers.set(userId, {
            id: userId,
            name: userData.name || userData.email || 'Team Member',
            email: userData.email,
            invitationStatus: 'accepted_incoming',
            acceptedAt: invitationData.acceptedAt
          });
        }
      } catch (error) {
        console.error("Error fetching incoming invitation user:", error);
      }
    }

    // Convert Map to Array and sort by name
    return Array.from(acceptedMembers.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
  } catch (error) {
    console.error("Error fetching accepted team members:", error);
    return [];
  }
};

/**
 * Get accepted team members filtered by project access
 * Only returns members who have access to the specific project
 */
export const getAcceptedTeamMembersForProject = async (currentUser, projectId) => {
  const allAcceptedMembers = await getAcceptedTeamMembers(currentUser);
  
  if (!projectId) return allAcceptedMembers;
  
  try {
    // Get project data to check team membership
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) return allAcceptedMembers;
    
    const projectData = projectSnap.data();
    const projectTeam = projectData.team || [];
    const projectCreatorId = projectData.userId;
    
    // Filter to only include members who are either:
    // 1. Already on the project team, OR
    // 2. Are accepted team members (for potential addition)
    return allAcceptedMembers.filter(member => 
      projectTeam.includes(member.id) || 
      member.id === projectCreatorId ||
      true // For now, include all accepted members as potential additions
    );
    
  } catch (error) {
    console.error("Error filtering accepted team members for project:", error);
    return allAcceptedMembers;
  }
};
