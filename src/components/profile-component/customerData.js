const customerData = [
  {
    "id": 1,
    "customerProfile": {
      "name": "John Smith",
      "email": "john.smith@techsolutions.com",
      "phone": "+1 (555) 123-4567"
    },
    "companyProfile": {
      "company": "Tech Solutions Inc",
      "industry": "IT Services",
      "location": "New York, USA"
    },
    "reputation": {
      "rating": 4,
      "summary": "Reliable partner, responsive to needs."
    },
    "activities": [
      { "type": "Gmail", "time": "2024-01-20 10:00", "description": "Sent introduction email" },
      { "type": "Call", "time": "2024-01-20 14:00", "description": "Initial consultation call completed" }
    ],
    "reminders": ["Follow up on proposal", "Schedule Q3 review"],
    "files": ["Proposal_TechSolutions.pdf", "Contract_TechSolutions.docx"],
    "currentStage": "Qualified",
    "stageData": {
      "Working": {
        "notes": ["Initial contact established. Client interested in our services."],
        "tasks": [
          { "name": "Send proposal", "done": true },
          { "name": "Schedule follow-up call", "done": true }
        ],
        "completed": true
      },
      "Qualified": {
        "notes": ["Proposal accepted. Discussing terms."],
        "tasks": [
          { "name": "Send contract", "done": false },
          { "name": "Final negotiation", "done": false }
        ],
        "completed": false
      },
      "Converted": {
        "notes": [],
        "tasks": [],
        "completed": false
      }
    }
  },
  {
    "id": 2,
    "customerProfile": {
      "name": "Sarah Johnson",
      "email": "sarah.j@digitalmarketing.com",
      "phone": "+1 (555) 234-5678"
    },
    "companyProfile": {
      "company": "Digital Marketing Pro",
      "industry": "Marketing",
      "location": "Los Angeles, USA"
    },
    "reputation": {
      "rating": 5,
      "summary": "Excellent collaboration, highly recommended."
    },
    "activities": [
      { "type": "Call", "time": "2024-01-18 11:30", "description": "Discussed Q1 campaign strategy" }
    ],
    "reminders": ["Prepare Q2 marketing plan"],
    "files": ["Marketing_Strategy_Q1.pptx"],
    "currentStage": "Working",
    "stageData": {
      "Working": {
        "notes": ["Reached out for initial contact."],
        "tasks": [
          { "name": "Send introductory email", "done": true },
          { "name": "Schedule demo", "done": false }
        ],
        "completed": false
      },
      "Qualified": {
        "notes": [],
        "tasks": [],
        "completed": false
      },
      "Converted": {
        "notes": [],
        "tasks": [],
        "completed": false
      }
    }
  },
  {
    "id": 3,
    "customerProfile": {
      "name": "Michael Chen",
      "email": "m.chen@innovationlabs.com",
      "phone": "+1 (555) 345-6789"
    },
    "companyProfile": {
      "company": "Innovation Labs",
      "industry": "R&D",
      "location": "Boston, USA"
    },
    "reputation": {
      "rating": 3,
      "summary": "Good potential, needs more engagement."
    },
    "activities": [],
    "reminders": ["Follow up on new product demo"],
    "files": [],
    "currentStage": "Converted",
    "stageData": {
      "Working": {
        "notes": ["Initial meeting conducted."],
        "tasks": [
          { "name": "Present product overview", "done": true }
        ],
        "completed": true
      },
      "Qualified": {
        "notes": ["Client showed strong interest in advanced features."],
        "tasks": [
          { "name": "Custom demo preparation", "done": true },
          { "name": "Send detailed proposal", "done": true }
        ],
        "completed": true
      },
      "Converted": {
        "notes": ["Contract signed. Onboarding in progress."],
        "tasks": [
          { "name": "Onboarding kickoff meeting", "done": true }
        ],
        "completed": true
      }
    }
  },
  {
    "id": 4,
    "customerProfile": {
      "name": "Emily Davis",
      "email": "emily.davis@creativestudios.com",
      "phone": "+1 (555) 456-7890"
    },
    "companyProfile": {
      "company": "Creative Studios",
      "industry": "Design",
      "location": "Austin, USA"
    },
    "reputation": {
      "rating": 5,
      "summary": "Highly creative and efficient."
    },
    "activities": [
      { "type": "Gmail", "time": "2024-01-22 09:00", "description": "Shared mood board concepts" }
    ],
    "reminders": [],
    "files": ["Design_Brief.pdf"],
    "currentStage": "Working",
    "stageData": {
      "Working": {
        "notes": ["Initial design brief discussed."],
        "tasks": [
          { "name": "Propose initial concepts", "done": false }
        ],
        "completed": false
      },
      "Qualified": {
        "notes": [],
        "tasks": [],
        "completed": false
      },
      "Converted": {
        "notes": [],
        "tasks": [],
        "completed": false
      }
    }
  },
  {
    "id": 5,
    "customerProfile": {
      "name": "David Wilson",
      "email": "d.wilson@globalent.com",
      "phone": "+1 (555) 567-8901"
    },
    "companyProfile": {
      "company": "Global Enterprises",
      "industry": "Logistics",
      "location": "Chicago, USA"
    },
    "reputation": {
      "rating": 4,
      "summary": "Organized and reliable in operations."
    },
    "activities": [],
    "reminders": ["Review logistics contract"],
    "files": ["Logistics_Agreement.pdf"],
    "currentStage": "Qualified",
    "stageData": {
      "Working": {
        "notes": ["Initial contact about logistics needs."],
        "tasks": [
          { "name": "Gather requirements", "done": true }
        ],
        "completed": true
      },
      "Qualified": {
        "notes": ["Quotation sent and under review."],
        "tasks": [
          { "name": "Follow up on quotation", "done": false }
        ],
        "completed": false
      },
      "Converted": {
        "notes": [],
        "tasks": [],
        "completed": false
      }
    }
  }
];

export default customerData;
  