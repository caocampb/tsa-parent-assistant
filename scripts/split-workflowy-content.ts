// Script to split Workflowy content by audience
import fs from 'fs';
import path from 'path';

// Categories and their target audience
const AUDIENCE_MAPPING = {
  // Coach-specific sections
  'Logistics': 'coach',
  'Real Estate / Facility': 'coach', 
  'Accreditation': 'coach',
  'Tuition & Payments': 'coach',
  'Vouchers & Scholarships': 'coach',
  'School Ops': 'coach',
  
  // Parent-specific sections
  'PRACTICE SCHEDULES': 'parent',
  'UNIFORM & EQUIPMENT': 'parent',
  'POLICIES': 'parent',
  'REGISTRATION': 'parent',
  'FAQ': 'parent',
  
  // Shared sections
  'Academics': 'shared',
  'Marketing Materials': 'shared'
};

// Keywords to help classify content
const COACH_KEYWORDS = [
  'franchise', 'revenue', 'LLC', 'incorporate', 'ESA provider',
  'affiliate agreement', 'coach', 'facility owner', 'business',
  '$15k', '$4k', 'TSA fee', 'platform fee', 'payout'
];

const PARENT_KEYWORDS = [
  'my child', 'parent', 'drop off', 'pick up', 'uniform',
  '$200/month', '$50', '$75', 'registration fee', 'practice'
];

function classifyContent(content: string): 'coach' | 'parent' | 'shared' {
  const lowerContent = content.toLowerCase();
  
  const coachScore = COACH_KEYWORDS.filter(kw => 
    lowerContent.includes(kw.toLowerCase())
  ).length;
  
  const parentScore = PARENT_KEYWORDS.filter(kw => 
    lowerContent.includes(kw.toLowerCase())
  ).length;
  
  if (coachScore > parentScore) return 'coach';
  if (parentScore > coachScore) return 'parent';
  return 'shared';
}

// Read your Workflowy content
const workflowyContent = `
[PASTE YOUR WORKFLOWY CONTENT HERE]

Logistics:
Who owns the school?
The coach owns the school. It's their school, they're just powered by Texas Sports Academy.
Is this a franchise?
This is close to a franchise because:
We provide lots of support
You get to say "[School Name], a Texas Sports Academy"
We are fully invested in your school succeeding
But it's still not a franchise — you own your school. We are partnered through an affiliate partnership. 
...

[Include all the content from your Workflowy export]
`;

// Split content into sections
const sections = workflowyContent.split(/\n(?=[A-Z][^:]*:)/);

const parentContent: string[] = [];
const coachContent: string[] = [];
const sharedContent: string[] = [];

for (const section of sections) {
  if (!section.trim()) continue;
  
  // Get section title
  const titleMatch = section.match(/^([^:]+):/);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Determine audience
  let audience: 'coach' | 'parent' | 'shared' = 'shared';
  
  // First check explicit mapping
  for (const [key, aud] of Object.entries(AUDIENCE_MAPPING)) {
    if (title.includes(key) || key.includes(title)) {
      audience = aud as any;
      break;
    }
  }
  
  // If not found, classify by content
  if (audience === 'shared') {
    audience = classifyContent(section);
  }
  
  // Add to appropriate array
  switch (audience) {
    case 'parent':
      parentContent.push(section);
      break;
    case 'coach':
      coachContent.push(section);
      break;
    default:
      sharedContent.push(section);
  }
}

// Write to files
fs.writeFileSync(
  path.join(process.cwd(), 'content/parent-handbook.txt'),
  parentContent.join('\n\n'),
  'utf-8'
);

fs.writeFileSync(
  path.join(process.cwd(), 'content/coach-guide.txt'),
  coachContent.join('\n\n'),
  'utf-8'
);

fs.writeFileSync(
  path.join(process.cwd(), 'content/shared-info.txt'),
  sharedContent.join('\n\n'),
  'utf-8'
);

console.log('✓ Split content into:');
console.log(`  - parent-handbook.txt (${parentContent.length} sections)`);
console.log(`  - coach-guide.txt (${coachContent.length} sections)`);
console.log(`  - shared-info.txt (${sharedContent.length} sections)`);


