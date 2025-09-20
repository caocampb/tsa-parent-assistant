import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

/**
 * Convert array to PostgreSQL array literal format
 * This prevents Supabase from stringifying the embedding
 */
function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// Categories mapping
const categoryMap: Record<string, string> = {
  'support': 'academics',
  'homework': 'academics',
  'MAP': 'academics',
  'test': 'academics',
  'special needs': 'academics',
  'IEP': 'academics',
  'ADHD': 'academics',
  'dyslexia': 'academics',
  'autism': 'academics',
  'screen': 'school_ops',
  'technology': 'school_ops',
  'prom': 'school_ops',
  'social': 'school_ops',
  'transcript': 'school_ops',
  'diploma': 'school_ops',
  'schedule': 'logistics',
  'hours': 'logistics',
  'time': 'logistics',
};

function determineCategory(question: string): string {
  const lowerQuestion = question.toLowerCase();
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lowerQuestion.includes(keyword)) {
      return category;
    }
  }
  return 'general_sales';
}

// Extract Q&A pairs from Alpha School Dean content
async function extractQAPairs(rawContent: string) {
  console.log('🤖 Using AI to extract Q&A pairs from Dean transcript...\n');

  const systemPrompt = `You are an expert at extracting Q&A pairs from educational transcripts.
Extract clear, searchable questions and comprehensive answers from the provided Dean Q&A session.

CRITICAL RULES:
1. Create multiple Q&A pairs from each topic (extract ALL valuable information)
2. Questions should be how parents would actually ask them
3. Answers should be complete and self-contained
4. Include specific details, numbers, and policies
5. Break complex topics into multiple focused Q&As

For each Q&A pair, provide:
- A clear, natural question
- A comprehensive answer that fully addresses the question
- Whether it's for 'parent', 'coach', or 'both' audiences

Output as JSON array with this structure:
[
  {
    "question": "How does TSA support children with ADHD?",
    "answer": "TSA supports ADHD students through the Pomodoro method (25 minutes on, 5 minutes off) which provides variety and breaks. Students have freedom of movement and aren't restricted to desks. The changing learning modalities throughout the day help maintain focus and engagement.",
    "audience": "parent"
  }
]`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ],
    // temperature: 0.3, // GPT-5 only supports default temperature
    response_format: { type: 'json_object' },
    // @ts-ignore - TypeScript might not have GPT-5 types yet
    reasoning_effort: 'high'  // Maximum extraction quality
  });

  const content = completion.choices[0].message.content || '[]';
  console.log('Raw AI response:', content.substring(0, 200) + '...'); // Debug log
  
  try {
    const parsed = JSON.parse(content);
    // Handle different response formats
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed.pairs && Array.isArray(parsed.pairs)) {
      return parsed.pairs;
    } else if (parsed.qa_pairs && Array.isArray(parsed.qa_pairs)) {
      return parsed.qa_pairs;
    } else if (parsed.qa && Array.isArray(parsed.qa)) {
      return parsed.qa;
    } else if (parsed.QAs && Array.isArray(parsed.QAs)) {
      return parsed.QAs;
    } else if (parsed.QA && Array.isArray(parsed.QA)) {
      return parsed.QA;
    } else if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions;
    } else {
      console.error('Unexpected response format:', parsed);
      return [];
    }
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Content was:', content);
    return [];
  }
}

// Also create document chunks for RAG fallback
async function createDocumentChunks(content: string, audience: 'parent' | 'coach' | 'shared') {
  console.log(`\n📄 Creating document chunks for ${audience} audience...`);
  
  // Simple chunking by question/answer pairs
  const questions = content.split(/Question \d+/);
  const chunks: string[] = [];
  
  for (const q of questions) {
    if (q.trim()) {
      // Split into smaller chunks if too long
      const parts = q.split('\n\n');
      for (const part of parts) {
        if (part.trim().length > 100) {
          chunks.push(part.trim());
        }
      }
    }
  }
  
  // Insert document record
  const docTable = `documents_${audience}`;
  const chunkTable = `document_chunks_${audience}`;
  
  const { data: document, error: docError } = await supabase
    .from(docTable)
    .insert({
      filename: 'alpha-dean-qa.txt',
      doc_type: 'handbook',
      idempotency_key: `alpha_dean_qa_${audience}_v1`
    })
    .select()
    .single();
    
  if (docError) {
    console.error('Error creating document:', docError);
    return;
  }
  
  console.log(`✓ Created document record: ${document.id}`);
  
  // Process chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        input: chunk,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      // Insert chunk
      await supabase
        .from(chunkTable)
        .insert({
          document_id: document.id,
          chunk_index: i,
          content: chunk,
          embedding: formatPgVector(embeddingResponse.data[0].embedding) as any
        });
        
      console.log(`✓ Inserted chunk ${i + 1}/${chunks.length}`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error(`Error processing chunk ${i}:`, error);
    }
  }
}

async function processAlphaContent() {
  // Read the Alpha School Dean Q&A content
  const alphaContent = fs.readFileSync(
    path.join(process.cwd(), 'content', 'alpha-dean-qa.txt'), 
    'utf-8'
  );
  
  // Check if document already exists
  const { data: existingDocs } = await supabase
    .from('documents_parent')
    .select('id, filename')
    .eq('filename', 'alpha-dean-qa.txt');
    
  const skipChunks = existingDocs && existingDocs.length > 0;
  if (skipChunks) {
    console.log('📝 Document chunks already exist, skipping chunk creation');
  }
  
  // 1. Extract Q&A pairs using AI
  const qaPairs = await extractQAPairs(alphaContent);
  console.log(`\n✨ Extracted ${qaPairs.length} Q&A pairs\n`);
  
  // 2. Process each Q&A pair
  let insertedCount = 0;
  for (const pair of qaPairs) {
    const category = determineCategory(pair.question);
    
    console.log(`\n📝 Processing: "${pair.question}"`);
    console.log(`   Category: ${category}`);
    console.log(`   Audience: ${pair.audience}`);
    
    try {
      // Generate embedding for the question
      const embeddingResponse = await openai.embeddings.create({
        input: pair.question,
        model: 'text-embedding-3-large',
        dimensions: 1536
      });
      
      // Insert Q&A pair
      const { error } = await supabase
        .from('qa_pairs')
        .insert({
          question: pair.question,
          answer: pair.answer,
          category: category,
          audience: pair.audience || 'parent',
          embedding: formatPgVector(embeddingResponse.data[0].embedding) as any
        });
        
      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Inserted successfully`);
        insertedCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   ❌ Error processing:`, error);
    }
  }
  
  console.log(`\n✅ Inserted ${insertedCount} Q&A pairs\n`);
  
  // 3. Also create document chunks for RAG fallback (if not already done)
  if (!skipChunks) {
    await createDocumentChunks(alphaContent, 'parent');
  }
  
  console.log('\n🎉 Alpha School content processing complete!');
  console.log(`   - ${insertedCount} Q&A pairs for fast responses`);
  console.log(`   - Document chunks ${skipChunks ? 'already exist' : 'created for RAG fallback'}`);
}

// First, save the Alpha content to a file
async function saveAlphaContent() {
  const alphaContent = `Alpha School: Q&A with the Dean of Students
Question 1
Parent: Thank you for having us in the school. We're really excited about this. It's a big change for our family. But one thing we are wondering is how can we, as parents, really support our children in this new school?

Dean: Well, I appreciate you asking the question, and I think one of the best ways to support your child is what you just did, and that's to ask questions. By virtue of you taking that concern and taking that care, it lets me know that you're really invested in how your students will do at our school. The things you can be asking and the ways you can support your child is to foster an independent learner. All of our learning within two hour learning is learner driven. And it's our instinct as parents to want to step in and solve our child's problems, but we want them to face a struggle. We want them to be stuck and learn how to become unstuck. And those practices can go beyond the classroom here. Two hour learning, you can take that home with your students. So rather than saying "Mom and Dad, where did I put this?" Talk with them about how they can solve their own problems. Have those conversations about what they can do to reach their goals, what are they doing each day? And then we of course also have our dash system, which is a tool in which you can log in on a daily basis and see the student's progress across every subject lesson. You're able to see individual progress. There'll be screen capture, to see how the students are doing. You'll be able to watch those videos with your student and discuss those at the dinner table. In addition to our cutting edge technology and best practices in regards to facing the struggle, it's also critical that all of our students feel supported both in school and at home. It's our guide's number one job to motivate and fuel your students. That fuel and motivation can only go so far when they're here. We also ask that you help provide that same fuel and motivation at home. That can come from ensuring that they're getting enough to eat, ensuring that they're getting a good night's sleep, having those conversations with them, and also looping in us when there are larger issues. We understand deaths in the family's personal emergencies. Those things happen. We want to help support you and your family. And so by keeping us abreast of what's going on with your child to the best of your ability, it helps us best support your child when they're at our school.

Question 2
Parent: So we're coming from an environment where there was a lot of homework. There was a big caseload when they came home. How much homework are we gonna have to deal with here? And what's that gonna be like when they come home from school?

Dean: Thank you for your question about homework. It's, it's a, a taboo word, a four letter word these days in a lot of schools. And I wanna stress that we have designed a program and the two hour learning curriculum in which it can be accomplished while the students are physically in our building. We want them to be excited and come in and meet their goals each day. For our high schoolers, it's closer to three hours, but still we want that to be accomplished during the school day. But we also understand that there is also motivation and hard work that goes into that time. So if a student isn't meeting their goals during the academic day, we will likely ask you to help support us at home by doing some of their lessons and masteries outside the building. That said, those are typically tied to motivation plans, and there'll also be incentives for students to meet those goals while they're in the building.

Question 3
Parent: So we're really excited to dive in and we're sold. We think this will be great, but I noticed that the first several days are all MAP testing. Can't we just get to the fun real stuff? Like why does MAP testing take so long and what's that gonna be like?

Dean: Thanks very much. MAP is a big part of what we do here. I know throughout your time or your child's time at other schools or your time in school, you're used to standardized testing. You know what, there's too much testing these days. Why are the kids always getting tested? And for us, MAP isn't just about getting points of data, it's about truly assessing where the students are across millions of points of data. The MAP growth assessment is administered by the Northwest Educational Association, the NWEA, and it's administered to schools based on grade level and age across the entire United States and internationally. It helps us know from a benchmark standpoint, both your students' achievement score where they are and compare to their peers. But also as we do this three times throughout the year, in both fall, winter, and spring, we're also able to set growth percentile goals for this child. This data year over year, longitudinally and longitudinally for your student will help indicate where they are, where they need to grow, and what we can do to help get them to those goals. If your student is showing, deficiency or has more help needed in a certain area, it'll help calibrate the two hour learning to help populate those individualized lesson plans for each student. It's also a great opportunity to see where your student who's sitting in Philadelphia versus Indiana versus Florida versus Texas, how they're doing on a day-to-day basis compared to their national peers. And in more of a typical school when it comes to MAP testing, students are given a one size fits all lesson for the day. Although the MAP testing might seem a little arduous to begin with, I assure you that it'll help calibrate and goal set and level set for each student individually. So your student will walk in each day getting exactly what he or she needs as opposed to their peers in other schools and where they're given a more universal lesson day to day.

Question 4
Parent: So again, we're really looking forward to this experience. My child has been diagnosed with special needs and he has an IEP and we really wanna find the right fit for him. How will this school help him? Or is this even a good fit?

Dean: Our method of learning allows for students to have a wide variety of academic instruction throughout the day. We utilize the Pomodoro method throughout our campuses, which is 25 minutes on, 5 minutes off. For our ADHD students, we found that's quite successful in regards to allowing them to have variety. Most students are typically in a 15 minute lecture or a 15 minute lesson, even at the lower levels with one teacher in front of the classroom. That level of variety and change of learning modality helps our students. We also allow our students some more freedom movement typically when they're learning. Not all of our students are always tied to a desk. They're able to move about the room, they're able to go into a space that might be more applicable or helpful for learning. For students with dyslexia, we do utilize some apps, some applications. One in particular is called Speechify, which allows for text to speech and speech text for students, which helps with some dyslexic needs. And then finally, from the autism spectrum point of view, it is of course a spectrum and people's needs, very widely across that spectrum. While we cannot guarantee we'll be able to provide the same level of those services to public school, we also understand that there are needs within that spectrum that we can meet within two hour learning, particularly when it comes to routine expectation and overall method of learning. We have found that students with autism typically thrive on routines. A sense of security and of the ability to work within topics that particularly interest them. Our guides are there to help motivate them through those needs and make sure that they're getting everything that they want. We also can work with outside therapists. If your family is currently utilizing ABA therapy, which is for autistic students, or if a student is typically receiving speech or physical therapy, we're happy to work with you outside of school to ensure that the student's information is being shared with our guides. So in summary, if you are a public school, IEPs and 504 are federally required interventions and needs for the students. Make sure you're discussing with your special education staff, whether that's your school psychologist, local 504 rep or district administrator, as well as any special education staff on campus to ensure that two hour learning will be a good specialized service for your student. At a private school, it's critical that we understand how the student learns what it is they need to be successful, and whether or not two hour learning can offer those accommodations for the students. There's a big distinction between an accommodation and a modification for a student. And an accommodation essentially means that I have a light bulb in the top of my room and I need to screw it in. I'll give the kid a ladder to climb up there. A modification says the light bulb doesn't need to be screwed in anymore. At a two hour learning, we do not offer modifications to our curriculum. Every student, although they might learn in a different way, is expected to meet the same goals after their time is finished within two hour learning. If you think that two hour learning is a good fit for your special needs child, please make sure that we're all having a conversation and we meet and discuss what it is they need to be successful and determine if this is the right fit for your student

Question 5
Parent: So we did the MAP testing. I have an eighth grader and we got the results back and it said fourth grade math. I mean, come on, this is an eighth grade kid. We're frankly ashamed about that and we don't really know how to move forward.

Dean: Thanks very much for bringing this to me and I really appreciate your vulnerability. And the question, I know it's a tough one. Two hour learning was founded because education is broken and an eighth grader being a fourth grade math, is not only typical, it's unfortunately more the norm than not. In a lot of schools across the country, yes, we have students who are performing exceptionally well, and we have students that come in and are blowing our tests out of the water. But the reason you came to two hour learning, the reason we have this conversation is you're concerned about your son and how he's doing in that. And I wanna stress that a fourth grade level isn't necessarily indicative of him not having other mastery within the mathematics spectrum. Our way of taking students through this process is by administering the MAP assessment. The MAP assessment takes all of the norms for eighth grade, and it begins a bracketing process for your child. So essentially, it is an intuitive test in the sense that it will ask a question. If a student gets it right, it'll continue through the curriculum. If they get it wrong, it'll start to go backwards to the curriculum. The AI then takes that information and helps to populate a skill plan for the child. So we believe in whole filling for our child, W-H-O-L-E, where every student is adding their needs to that by filling the hole of the curriculum. Most students in schools are used to taking a test at the end of the year, maybe getting a grade card with an A or B, and all of a sudden they're done with fourth grade. Well, when your child was doing that, he wasn't being met with the actual assessment that measures mastery for how they're doing. Now we're actually figuring out what mathematical skills are foundationally there and which ones are not. So even though he's in fourth grade math, it doesn't mean he's totally devoid of the other mathematics skills. He'll need to be a successful eighth grader, but we're grateful that we've identified those gaps and now we're gonna start to fill those at a rapid pace. He is going to get through approximately fourth grade math in 40 hours over the next few months as opposed to the entire 10 month school year for most students. We are really excited about the process he's going to make, and we're confident that adherence to this process and continual hard work from your child will lead to huge dividends.

Question 6
Parent: My kids spend a lot of time on screens. Are we just enrolling them into school, but they're gonna be on screens the whole time? How can we minimize screen time here?

Dean: Thanks for the question about screen time, and I wish we would've done this over soon so we could have screen time together. Kidding, of course. We understand the apprehension of screen time. We've gone from no screens less than 30 years ago to daily screen usage. Two hour learning is designed to be two hours on the screen, three hours for high schoolers, and then some potential workshop use in the afternoon. But typically a student while they're in our building, should be spending probably under three hours a day for students below ninth grade. That may seem like a lot still, especially if they're using screens at home. But I want to emphasize a few key points and a typical middle school across the United States, students are spending upwards of six hours on their screen or at least screen adjacent throughout their day, whether it's from a teacher lecturing, staring at a smart board, or it's them working on their individual Chromebooks or laptops. That stark contrast seems a little different for families when they come here. They feel like it's going to be all screens, but we like to say that two hour learning in the AI tutor and the driving force of our applications for the student's dashboard is about 10% of the secret sauce. The 90% is sitting across the table right now, and that's our guides and our instructional staff. We believe that having access to that screen is simply opening the door. The student needs to be able to walk through it, and that's what our guides are going to do. They're gonna motivate, they're going to excite, and they're gonna make sure the students are really loving school. That's our number one priority. And so yes, they will have screens in the morning, but typically that two hour learning in the morning will be broken up across three hours with some breaks, some recess, some lunch, and then the afternoon. Those life skills workshops, yes, they may use the screen to iterate or do something in that process, but there will be many, many life skills workshops that are totally different than what you're used to. So you'll have students who are working outside, you'll have students accomplishing physical feat. So you'll have students that will be building or starting their own businesses and working on salesmanship, public speaking, entrepreneurship, grit, financial literacy. These are all things that can utilize the screen, but don't necessarily have to. And we're really excited about how we can take that focused core learning in the morning for two hours and allow the students to step away from those screens in the afternoon.

Question 7
Parent: So this school is unlike a lot of the other schools out there. If for some reason, you know, we need to move to another city, is there a transcript that can go with my kids and, and when they want to apply to college? But how, I mean, how does this fit with other transcripts? What do you have?

Dean: Thanks for the question. We are very proud of the amount of data we have for every single student in our buildings. From a transcript standpoint, before they get to high school, we're gonna be able to offer your accepting school, the school you're moving to, a comprehensive picture of exactly how your student's doing across every subject matter, across every single lesson. We'll be able to take the standards for that state, be it Texas, Arizona, California, and say, this is exactly how far this student got. And within each subject and what they learned and what they didn't learn. From a high school standpoint, our mastery based learning and the ability for students to focus on specific subjects translates very easily to transcripts, procurements. We've had students admitted to Vanderbilt, Stanford, University of Texas at Austin, and we're very proud of the work they've done. And our model lent us up quite well to producing those transcripts.

Question 8
Parent: So it's a big jump coming from public school to this environment. I've always kind of thought my kids would go to prom and, you know, go to the football games and those are such a big part of growing up that I've been looking forward to that. And this is kind of a different thing. What do you just say to parents who are concerned about missing those big milestones?

Dean: We're really excited to celebrate those milestones with you and your family. And we understand that while it may not look like it does in the Breakfast Club or something like that, we also believe that we are offering our students revolutionary educational options that will lead to some innovative and different ways of approaching this more stereotypical high school or middle school events. From a sports standpoint, the vast majority of our students do partake in clubs outside of school when it comes to sports. The two hour learning really helps with that process in the sense the students are able to get their academics done in a day and they're not trying to read a fellow on the van ride over to the soccer field. Really helpful. And then from a high school standpoint, we do offer prom. We do have those options for students. They're gonna look a little different. It might not be 300 kids at the local Elk Lodge. It might be, you know, a few handfuls of students that are cited to bring their significant others or their friends to what is a very fun and culminating high school event. We are also open to iterating and changing how we approach those processes. So maybe prom will look different for virtual learning students at this school and we're excited to talk about what that might be.`;

  // Save to file
  fs.writeFileSync(
    path.join(process.cwd(), 'content', 'alpha-dean-qa.txt'),
    alphaContent
  );
  
  console.log('✅ Saved Alpha School content to content/alpha-dean-qa.txt');
}

// Run the process
async function main() {
  // First save the content (skip if already exists)
  const contentPath = path.join(process.cwd(), 'content', 'alpha-dean-qa.txt');
  if (!fs.existsSync(contentPath)) {
    await saveAlphaContent();
  } else {
    console.log('✅ Alpha content file already exists');
  }
  
  // Then process it
  await processAlphaContent();
}

main().catch(console.error);
