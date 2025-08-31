import { db } from '../firebase';
import { doc, updateDoc, setDoc, addDoc, collection, serverTimestamp, getDoc, getDocs, query, where, orderBy, deleteDoc } from 'firebase/firestore';

// Basic ID helper for client-side generated IDs (not used for Firestore docs)
const genId = () => Date.now() + Math.random();

// ---------- Template Catalog ----------

// General customer template mirrors current defaults (Working → Qualified → Converted)
export const customerGeneralTemplate = {
  id: 'customer_general_v1',
  type: 'customer',
  name: 'General – Customer Profile',
  version: 1,
  outline: {
    stages: [
      { name: 'Working', tasks: [] },
      { name: 'Qualified', tasks: [] },
      { name: 'Converted', tasks: [] }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

// Provided example normalized for customer
export const customerNewAcquisitionTemplate = {
  id: 'customer_new_acquisition_v1',
  type: 'customer',
  name: 'New Customer Acquisition SOP',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Lead Capture',
        tasks: [
          { title: 'Record company info' },
          { title: 'Identify decision maker' },
          { title: 'Log first contact details' }
        ]
      },
      {
        name: 'Qualification',
        tasks: [
          { title: 'Assess customer needs' },
          { title: 'Check budget and timeline' },
          { title: 'Mark as qualified lead' }
        ]
      },
      {
        name: 'Proposal Stage',
        tasks: [
          { title: 'Prepare initial quotation' },
          { title: 'Send proposal to customer' },
          { title: 'Schedule follow-up meeting' }
        ]
      }
    ]
  },
  defaultReminders: ['Follow-up in 3 days after first contact'],
  defaultFiles: []
};

// Customer Onboarding SOP (post-deal, pre-project)
export const customerOnboardingTemplate = {
  id: 'customer_onboarding_v1',
  type: 'customer',
  name: 'Customer Onboarding SOP',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Information Gathering',
        tasks: [
          { title: 'Collect company registration details' },
          { title: 'Get contact persons info' },
          { title: 'Confirm industry & project scope' }
        ]
      },
      {
        name: 'Setup & Agreements',
        tasks: [
          { title: 'Prepare service agreement' },
          { title: 'Confirm billing details' },
          { title: 'Upload signed documents' }
        ]
      },
      {
        name: 'Kickoff Preparation',
        tasks: [
          { title: 'Set reminder for project start' },
          { title: 'Schedule kickoff meeting' },
          { title: 'Assign internal account manager' }
        ]
      }
    ]
  },
  defaultReminders: ['Kickoff meeting reminder'],
  defaultFiles: []
};

// Customer Relationship Management (CRM) SOP (ongoing customers)
export const customerCrmTemplate = {
  id: 'customer_crm_v1',
  type: 'customer',
  name: 'Customer Relationship Management SOP',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Regular Check-ins',
        tasks: [
          { title: 'Monthly check-in call' },
          { title: 'Update contact notes' },
          { title: 'Log customer feedback' }
        ]
      },
      {
        name: 'Upsell/Expansion',
        tasks: [
          { title: 'Identify cross-sell opportunities' },
          { title: 'Share new product/service updates' },
          { title: 'Prepare upsell quotation' }
        ]
      },
      {
        name: 'Renewal/Retention',
        tasks: [
          { title: 'Remind customer of contract renewal' },
          { title: 'Prepare renewal quotation' },
          { title: 'Collect renewal confirmation' }
        ]
      }
    ]
  },
  defaultReminders: ['Monthly customer follow-up'],
  defaultFiles: []
};

export const customerSopTemplates = [
  customerGeneralTemplate,
  customerNewAcquisitionTemplate,
  customerOnboardingTemplate,
  customerCrmTemplate
];

// General project template mirrors default project stages (Planning → Development → Testing → Completed)
export const projectGeneralTemplate = {
  id: 'project_general_v1',
  type: 'project',
  name: 'General – Project Board',
  version: 1,
  outline: {
    stages: [
      { name: 'Planning', sections: [] },
      { name: 'Development', sections: [] },
      { name: 'Testing', sections: [] },
      { name: 'Completed', sections: [] }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

// Provided example normalized for project
export const projectConstructionTemplate = {
  id: 'project_construction_v1',
  type: 'project',
  name: 'Construction Project SOP',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Site Survey & Planning',
        sections: [
          {
            name: 'Survey Tasks',
            tasks: [
              { title: 'Collect site drawings' },
              { title: 'Conduct soil test' },
              { title: 'Prepare survey report' }
            ]
          }
        ]
      },
      {
        name: 'Quotation & Approval',
        sections: [
          {
            name: 'Quotation Process',
            tasks: [
              { title: 'Prepare cost estimation' },
              { title: 'Send quotation to client' },
              { title: 'Approval from project manager' }
            ]
          }
        ]
      },
      {
        name: 'Execution',
        sections: [
          {
            name: 'Foundation',
            tasks: [
              { title: 'Order cement' },
              { title: 'Check soil compaction' },
              { title: 'Pour concrete' }
            ]
          },
          {
            name: 'Structural Work',
            tasks: [
              { title: 'Erect steel framework' },
              { title: 'Install scaffolding' },
              { title: 'Conduct safety inspection' }
            ]
          }
        ]
      }
    ]
  },
  defaultReminders: [
    { title: 'Weekly site progress report', date: null, time: null }
  ],
  defaultFiles: []
};

// Manufacturing Project Setup
export const projectManufacturingTemplate = {
  id: 'project_manufacturing_v1',
  type: 'project',
  name: 'Manufacturing Project Setup',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Requirement Gathering',
        sections: [
          { name: 'Capacity Planning', tasks: [
            { title: 'Define output goals' },
            { title: 'Analyze demand' }
          ] }
        ]
      },
      {
        name: 'Design & Process Planning',
        sections: [
          { name: 'Process Flow', tasks: [
            { title: 'Create production flow' },
            { title: 'Define QC checkpoints' }
          ] }
        ]
      },
      {
        name: 'Procurement of Machinery',
        sections: [
          { name: 'Vendor Selection', tasks: [
            { title: 'Collect quotations' },
            { title: 'Purchase equipment' }
          ] }
        ]
      },
      {
        name: 'Installation & Setup',
        sections: [
          { name: 'Factory Setup', tasks: [
            { title: 'Install machines' },
            { title: 'Calibrate systems' }
          ] }
        ]
      },
      {
        name: 'Test Runs & Quality Check',
        sections: [
          { name: 'Trial Production', tasks: [
            { title: 'Run test batch' },
            { title: 'Validate output' }
          ] }
        ]
      },
      {
        name: 'Production Go-Live',
        sections: [
          { name: 'Final Launch', tasks: [
            { title: 'Start production' },
            { title: 'Monitor output' }
          ] }
        ]
      }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

// IT / Software Development Lifecycle
export const projectItDevTemplate = {
  id: 'project_itdev_v1',
  type: 'project',
  name: 'IT / Software Development Lifecycle',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Requirement Analysis',
        sections: [
          { name: 'User Stories', tasks: [
            { title: 'Gather requirements' },
            { title: 'Prioritize features' }
          ] }
        ]
      },
      {
        name: 'System Design',
        sections: [
          { name: 'Architecture', tasks: [
            { title: 'Design system' },
            { title: 'Create wireframes' }
          ] }
        ]
      },
      {
        name: 'Development',
        sections: [
          { name: 'Coding', tasks: [
            { title: 'Implement features' },
            { title: 'Commit to repo' }
          ] }
        ]
      },
      {
        name: 'Testing & QA',
        sections: [
          { name: 'Validation', tasks: [
            { title: 'Unit tests' },
            { title: 'Integration tests' }
          ] }
        ]
      },
      {
        name: 'Deployment',
        sections: [
          { name: 'Go-Live', tasks: [
            { title: 'Deploy to server' },
            { title: 'Monitor errors' }
          ] }
        ]
      },
      {
        name: 'Maintenance & Support',
        sections: [
          { name: 'Post-Launch', tasks: [
            { title: 'Fix bugs' },
            { title: 'Provide updates' }
          ] }
        ]
      }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

// Marketing Campaign Workflow
export const projectMarketingTemplate = {
  id: 'project_marketing_v1',
  type: 'project',
  name: 'Marketing Campaign Workflow',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Campaign Planning',
        sections: [
          { name: 'Strategy', tasks: [
            { title: 'Define goals' },
            { title: 'Set budget' }
          ] }
        ]
      },
      {
        name: 'Content Creation',
        sections: [
          { name: 'Design & Copy', tasks: [
            { title: 'Create visuals' },
            { title: 'Write captions' }
          ] }
        ]
      },
      {
        name: 'Media Buying',
        sections: [
          { name: 'Channel Setup', tasks: [
            { title: 'Choose platforms' },
            { title: 'Book ads' }
          ] }
        ]
      },
      {
        name: 'Launch Campaign',
        sections: [
          { name: 'Execution', tasks: [
            { title: 'Publish content' },
            { title: 'Schedule posts' }
          ] }
        ]
      },
      {
        name: 'Monitor & Optimize',
        sections: [
          { name: 'Performance Tracking', tasks: [
            { title: 'Check analytics' },
            { title: 'Adjust targeting' }
          ] }
        ]
      },
      {
        name: 'Final Report & ROI Review',
        sections: [
          { name: 'Closure', tasks: [
            { title: 'Prepare report' },
            { title: 'Evaluate ROI' }
          ] }
        ]
      }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

// Healthcare Facility Upgrade
export const projectHealthcareTemplate = {
  id: 'project_healthcare_v1',
  type: 'project',
  name: 'Healthcare Facility Upgrade',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Needs Assessment',
        sections: [
          { name: 'Gap Analysis', tasks: [
            { title: 'Assess current facilities' },
            { title: 'Define needs' }
          ] }
        ]
      },
      {
        name: 'Vendor Selection',
        sections: [
          { name: 'Procurement', tasks: [
            { title: 'Request proposals' },
            { title: 'Evaluate vendors' }
          ] }
        ]
      },
      {
        name: 'Equipment Procurement',
        sections: [
          { name: 'Purchase', tasks: [
            { title: 'Order equipment' },
            { title: 'Arrange logistics' }
          ] }
        ]
      },
      {
        name: 'Installation & Staff Training',
        sections: [
          { name: 'Setup', tasks: [
            { title: 'Install equipment' },
            { title: 'Conduct training' }
          ] }
        ]
      },
      {
        name: 'Safety & Compliance Check',
        sections: [
          { name: 'Audit', tasks: [
            { title: 'Run compliance tests' },
            { title: 'Obtain certifications' }
          ] }
        ]
      },
      {
        name: 'Handover to Operations',
        sections: [
          { name: 'Finalization', tasks: [
            { title: 'Transfer to staff' },
            { title: 'Close project' }
          ] }
        ]
      }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

// Event Management Workflow
export const projectEventTemplate = {
  id: 'project_event_v1',
  type: 'project',
  name: 'Event Management Workflow',
  version: 1,
  outline: {
    stages: [
      {
        name: 'Concept & Budgeting',
        sections: [
          { name: 'Planning', tasks: [
            { title: 'Define event theme' },
            { title: 'Set budget' }
          ] }
        ]
      },
      {
        name: 'Venue & Vendor Booking',
        sections: [
          { name: 'Arrangements', tasks: [
            { title: 'Book venue' },
            { title: 'Hire vendors' }
          ] }
        ]
      },
      {
        name: 'Promotion & Invitations',
        sections: [
          { name: 'Marketing', tasks: [
            { title: 'Create invites' },
            { title: 'Promote event' }
          ] }
        ]
      },
      {
        name: 'Event Execution',
        sections: [
          { name: 'On-Site Management', tasks: [
            { title: 'Coordinate staff' },
            { title: 'Run event schedule' }
          ] }
        ]
      },
      {
        name: 'Post-Event Feedback',
        sections: [
          { name: 'Survey', tasks: [
            { title: 'Collect attendee feedback' },
            { title: 'Analyze results' }
          ] }
        ]
      },
      {
        name: 'Financial Closure',
        sections: [
          { name: 'Wrap-Up', tasks: [
            { title: 'Clear payments' },
            { title: 'Close accounts' }
          ] }
        ]
      }
    ]
  },
  defaultReminders: [],
  defaultFiles: []
};

export const projectSopTemplates = [
  projectGeneralTemplate,
  projectConstructionTemplate,
  projectManufacturingTemplate,
  projectItDevTemplate,
  projectMarketingTemplate,
  projectHealthcareTemplate,
  projectEventTemplate
];

// ---------- Apply Engines ----------

// Apply a customer SOP to an existing customerProfiles/{id}
export async function applyCustomerSopTemplate(customerId, template) {
  if (!customerId || !template || template.type !== 'customer') return;
  // Build stages and stageData structure matching CustomerProfile expectations
  const stages = (template.outline?.stages || []).map(s => s.name).filter(Boolean);
  if (stages.length === 0) stages.push('Working', 'Qualified', 'Converted');
  const stageData = {};
  stages.forEach(name => {
    const spec = (template.outline?.stages || []).find(s => s.name === name) || {};
    const tasks = Array.isArray(spec.tasks) ? spec.tasks : [];
    stageData[name] = {
      notes: Array.isArray(spec.notes) ? spec.notes.map(String) : [],
      tasks: tasks.map(t => ({ name: String(t.title || t.name || ''), done: false })),
      completed: false
    };
  });
  // Merge reminders/files: keep existing if present
  try {
    const cref = doc(db, 'customerProfiles', customerId);
    const snap = await getDoc(cref);
    const existing = snap.exists() ? (snap.data() || {}) : {};
    // Overwrite with template-selected values (not merge), per request
    const rawReminders = Array.isArray(template.defaultReminders) ? template.defaultReminders : [];
    // Default due date: today + 7 days at 09:00 if not provided by template
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const defaultDate = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
    const defaultTime = '09:00';
    const reminders = rawReminders.map((r) => {
      const title = (typeof r === 'string') ? r : String(r?.title || 'Reminder');
      const hasDate = typeof r === 'object' && r && (r.date || r.dueDate);
      const hasTime = typeof r === 'object' && r && (r.time || r.dueTime);
      const date = hasDate ? String(r.date || r.dueDate) : defaultDate;
      const time = hasTime ? String(r.time || r.dueTime) : defaultTime;
      const description = (typeof r === 'object') ? String(r.description || '') : '';
      return { title, description, date, time };
    });
    const files = Array.isArray(template.defaultFiles) ? template.defaultFiles : [];
    await updateDoc(cref, {
      stages,
      stageData,
      currentStage: stages[0],
      reminders,
      files,
      sopTemplateId: template.id,
      sopVersion: Number(template.version || 1)
    });
  } catch {}
}

// Apply a project SOP to an existing projects/{id}
export async function applyProjectSopTemplate(projectId, template) {
  if (!projectId || !template || template.type !== 'project') return;
  const stages = (template.outline?.stages || []).map(s => s.name).filter(Boolean);
  if (stages.length === 0) stages.push('Planning', 'Development', 'Testing', 'Completed');
  // Build ProjectTaskPanel-compatible sections array
  const sections = [];
  (template.outline?.stages || []).forEach(stage => {
    const sName = stage?.name || '';
    const secs = Array.isArray(stage?.sections) ? stage.sections : [];
    secs.forEach(sec => {
      const subtitle = {
        id: genId(),
        name: String(sec.name || 'Section'),
        color: '#3b82f6',
        tasks: Array.isArray(sec.tasks) ? sec.tasks.map(t => ({ id: genId(), name: String(t.title || t.name || ''), done: false, status: 'working on' })) : [],
        stage: sName
      };
      sections.push(subtitle);
    });
  });
  try {
    const pref = doc(db, 'projects', projectId);
    await updateDoc(pref, {
      stages,
      stage: stages[0],
      tasks: sections,
      files: Array.isArray(template.defaultFiles) ? template.defaultFiles.map(String) : [],
      sopTemplateId: template.id,
      sopVersion: Number(template.version || 1)
    });
    // Seed default reminders as subcollection docs
    const rems = Array.isArray(template.defaultReminders) ? template.defaultReminders : [];
    for (let i = 0; i < rems.length; i++) {
      const r = rems[i];
      const title = (typeof r === 'string') ? r : String(r?.title || 'Reminder');
      // Default due date: today + 7 days at 09:00 if not provided by template
      const hasDate = typeof r === 'object' && r && (r.date || r.dueDate);
      const hasTime = typeof r === 'object' && r && (r.time || r.dueTime);
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const defaultDate = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
      const defaultTime = '09:00';
      const date = hasDate ? String(r.date || r.dueDate) : defaultDate;
      const time = hasTime ? String(r.time || r.dueTime) : defaultTime;
      try {
        await addDoc(collection(db, 'projects', projectId, 'reminders'), { title, description: (typeof r === 'object' ? String(r.description || '') : ''), date, time, timestamp: serverTimestamp() });
      } catch {}
    }
    // Optionally seed default file names into project doc as a simple list (non-Drive placeholders)
    try {
      const snap = await getDoc(pref);
      const existing = snap.exists() ? (snap.data() || {}) : {};
      const files = Array.isArray(existing.files) ? existing.files : [];
      const toAdd = Array.isArray(template.defaultFiles) ? template.defaultFiles.map(String) : [];
      if (toAdd.length > 0) {
        await updateDoc(pref, { files: [...files, ...toAdd] });
      }
    } catch {}
  } catch {}
}

export function listSopTemplates(kind = 'customer') {
  return kind === 'project' ? projectSopTemplates : customerSopTemplates;
}

// ---------- User Template APIs ----------
// Storage shape: users/{uid}/sopTemplates/{docId}
// { id, type: 'customer'|'project', name, version, outline, defaultReminders, defaultFiles, createdAt, updatedAt }

export async function listUserSopTemplates({ userId, kind }) {
  if (!userId) return [];
  try {
    const ref = collection(db, 'users', userId, 'sopTemplates');
    const qy = kind ? query(ref, where('type', '==', kind)) : ref;
    const snap = await getDocs(qy);
    const out = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      out.push({ ...d, _docId: docSnap.id });
    });
    return out;
  } catch { return []; }
}

export async function saveUserSopTemplate({ userId, template }) {
  if (!userId || !template) return null;
  const ref = collection(db, 'users', userId, 'sopTemplates');
  const docData = {
    id: String(template.id || `user_${Date.now()}`),
    type: template.type === 'project' ? 'project' : 'customer',
    name: String(template.name || 'Untitled Template'),
    version: Number(template.version || 1),
    outline: template.outline || { stages: [] },
    defaultReminders: Array.isArray(template.defaultReminders) ? template.defaultReminders : [],
    defaultFiles: Array.isArray(template.defaultFiles) ? template.defaultFiles : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    // If caller passes a _docId, update instead of add
    if (template._docId) {
      await updateDoc(doc(db, 'users', userId, 'sopTemplates', template._docId), docData);
      return { ...docData, _docId: template._docId };
    }
    const added = await addDoc(ref, docData);
    return { ...docData, _docId: added.id };
  } catch { return null; }
}

export async function updateUserSopTemplate({ userId, docId, template }) {
  if (!userId || !docId || !template) return false;
  try {
    await updateDoc(doc(db, 'users', userId, 'sopTemplates', docId), {
      ...template,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch { return false; }
}

export async function deleteUserSopTemplate({ userId, docId }) {
  if (!userId || !docId) return false;
  try {
    await deleteDoc(doc(db, 'users', userId, 'sopTemplates', docId));
    return true;
  } catch { return false; }
}


