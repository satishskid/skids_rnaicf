/**
 * Parent-friendly educational content for individual child reports.
 *
 * MODULE_EDUCATION: Per-module intro, method, and healthy message.
 * CONDITION_PARENT_INFO: Per-condition parent description, prevalence, intervention.
 * MODULE_BODY_POSITIONS: Anatomical positions for body diagram overlays.
 *
 * These are static strings — no LLM calls needed at render time.
 * Ported from V2 parent-education.ts — zero content changes.
 */

import type { ModuleType } from './types'

// ─── Per-Module Education ────────────────────────────────────────

export interface ModuleEducation {
  intro: string          // 2-3 sentence parent-friendly description
  method: string         // e.g., "Visual Screening", "AI-Assisted Imaging"
  healthyMessage: string // Message shown when no findings
}

export const MODULE_EDUCATION: Partial<Record<ModuleType, ModuleEducation>> = {
  // ── Vitals & Measurements ──
  height: {
    intro: 'Height measurement helps track your child\'s growth over time. Comparing height to WHO standards identifies children who may be growing slower or faster than expected for their age.',
    method: 'Physical Measurement',
    healthyMessage: 'Your child\'s height is within the normal range for their age and gender.',
  },
  weight: {
    intro: 'Weight measurement is essential for monitoring nutrition and overall health. It helps detect undernutrition, overnutrition, and track healthy growth patterns.',
    method: 'Physical Measurement',
    healthyMessage: 'Your child\'s weight is within the healthy range for their age and gender.',
  },
  vitals: {
    intro: 'Vital signs measurement checks your child\'s heart rate and basic cardiovascular function. This non-contact screening uses advanced video technology to detect heart rate from facial skin color changes.',
    method: 'AI-Assisted Video Analysis (rPPG)',
    healthyMessage: 'Your child\'s vital signs, including heart rate, are within normal limits.',
  },
  spo2: {
    intro: 'Oxygen saturation (SpO2) measures how well oxygen is being carried in your child\'s blood. Low levels may indicate respiratory or cardiac issues that need attention.',
    method: 'Pulse Oximetry',
    healthyMessage: 'Your child\'s blood oxygen level is normal (95-100%).',
  },
  hemoglobin: {
    intro: 'Hemoglobin testing checks for anemia, a common condition in children that can affect energy levels, concentration, and growth. Low hemoglobin often indicates iron deficiency.',
    method: 'Point-of-Care Testing',
    healthyMessage: 'Your child\'s hemoglobin levels are within the normal range, indicating no signs of anemia.',
  },
  bp: {
    intro: 'Blood pressure screening helps detect early signs of hypertension, which can occur even in children. Early detection allows for lifestyle changes that prevent long-term complications.',
    method: 'Digital Sphygmomanometry',
    healthyMessage: 'Your child\'s blood pressure is within the healthy range for their age and height.',
  },

  // ── Head-to-Toe Examination ──
  general_appearance: {
    intro: 'General appearance assessment evaluates your child\'s overall health presentation, including alertness, skin color, posture, and signs of distress. It provides a first impression of general well-being.',
    method: 'AI-Assisted Visual Screening',
    healthyMessage: 'Your child appears healthy with good color, alertness, and overall appearance.',
  },
  hair: {
    intro: 'Hair and scalp examination checks for conditions like fungal infections, lice, alopecia, and signs of nutritional deficiency. Healthy hair often reflects good overall nutrition.',
    method: 'Visual Screening',
    healthyMessage: 'Your child\'s hair and scalp appear healthy with no signs of infection or abnormality.',
  },
  eyes_external: {
    intro: 'External eye examination evaluates the appearance of the eyes, eyelids, and surrounding structures. It can detect infections, alignment issues, and congenital abnormalities.',
    method: 'AI-Assisted Imaging',
    healthyMessage: 'Your child\'s external eye examination shows no abnormalities.',
  },
  vision: {
    intro: 'Vision screening checks for conditions that may affect your child\'s ability to see clearly. Early detection of vision problems is critical because untreated conditions like amblyopia can become permanent if not caught before age 7-8.',
    method: 'AI-Assisted Photoscreening',
    healthyMessage: 'Your child\'s vision screening results are within normal range. No signs of refractive error or alignment issues were detected.',
  },
  ear: {
    intro: 'Ear screening examines the ear canal and eardrum for signs of infection, fluid buildup, or structural abnormalities. Ear conditions, if untreated, can lead to hearing loss and speech delays.',
    method: 'AI-Assisted Otoscopy',
    healthyMessage: 'Your child\'s ear examination shows healthy ear canals and eardrums with no signs of infection or fluid.',
  },
  hearing: {
    intro: 'Hearing screening assesses your child\'s ability to hear sounds at different frequencies. Even mild hearing loss can significantly impact speech development, learning, and social interaction.',
    method: 'Audiometric Screening',
    healthyMessage: 'Your child\'s hearing appears normal across all tested frequencies.',
  },
  nose: {
    intro: 'Nasal examination checks for conditions like deviated septum, polyps, chronic congestion, and signs of allergic rhinitis. Nasal obstruction can affect breathing, sleep, and overall quality of life.',
    method: 'AI-Assisted Visual Screening',
    healthyMessage: 'Your child\'s nasal examination shows no abnormalities or signs of obstruction.',
  },
  dental: {
    intro: 'Dental screening evaluates teeth and gums for cavities, gum disease, alignment issues, and oral hygiene. Dental health in childhood directly impacts permanent teeth development and overall health.',
    method: 'AI-Assisted Imaging & Video',
    healthyMessage: 'Your child\'s dental examination shows healthy teeth and gums with no cavities or significant concerns.',
  },
  throat: {
    intro: 'Throat examination checks the tonsils, pharynx, and oral cavity for signs of infection, enlargement, or structural abnormalities. Enlarged tonsils can cause breathing and sleep issues.',
    method: 'AI-Assisted Video Screening',
    healthyMessage: 'Your child\'s throat examination shows normal tonsils and pharynx with no signs of infection.',
  },
  neck: {
    intro: 'Neck and thyroid examination checks for enlarged lymph nodes, thyroid gland abnormalities, and other neck masses. Thyroid issues can affect growth, metabolism, and development.',
    method: 'Visual & Video Screening',
    healthyMessage: 'Your child\'s neck examination shows no enlarged lymph nodes or thyroid abnormalities.',
  },
  respiratory: {
    intro: 'Respiratory screening uses audio technology to listen to lung sounds and detect abnormal breathing patterns. It can identify wheezing, crackles, or other signs of respiratory conditions.',
    method: 'AI-Assisted Audio Analysis',
    healthyMessage: 'Your child\'s respiratory sounds are clear and normal with no signs of wheezing or congestion.',
  },
  abdomen: {
    intro: 'Abdominal examination assesses for organ enlargement, tenderness, masses, or other abnormalities. It helps detect conditions affecting the liver, spleen, kidneys, and digestive system.',
    method: 'Visual Screening',
    healthyMessage: 'Your child\'s abdominal examination shows no abnormalities or areas of concern.',
  },
  skin: {
    intro: 'Skin examination checks for rashes, infections, lesions, birthmarks, and wounds. Skin conditions are common in children and may indicate allergies, infections, or nutritional deficiencies.',
    method: 'AI-Assisted Image Segmentation',
    healthyMessage: 'Your child\'s skin appears healthy with no significant lesions, rashes, or areas of concern.',
  },
  nails: {
    intro: 'Nail examination can reveal signs of nutritional deficiency (iron, zinc), fungal infections, or systemic conditions. Spoon-shaped nails, for example, are strongly associated with iron deficiency anemia.',
    method: 'Visual Screening',
    healthyMessage: 'Your child\'s nails appear healthy with no signs of nutritional deficiency or infection.',
  },
  posture: {
    intro: 'Posture and spine screening checks for scoliosis (lateral spine curvature), kyphosis (excessive forward rounding), and other postural abnormalities. Early detection allows for monitoring and, if needed, bracing to prevent progression.',
    method: 'AI-Assisted Visual Analysis',
    healthyMessage: 'Your child\'s posture and spine alignment appear normal with no signs of curvature.',
  },
  motor: {
    intro: 'Motor assessment evaluates your child\'s ability to perform age-appropriate movements — walking, running, balance, and coordination. Motor delays may indicate neurological or musculoskeletal conditions.',
    method: 'AI-Assisted Video & Gait Analysis',
    healthyMessage: 'Your child\'s motor skills are appropriate for their age with no coordination or balance concerns.',
  },
  lymph: {
    intro: 'Lymph node examination checks for enlarged or tender lymph nodes in the neck, armpits, and groin. Lymph nodes are part of the immune system, and enlargement may indicate infection or other conditions.',
    method: 'Clinical Palpation Assessment',
    healthyMessage: 'Your child\'s lymph nodes are not enlarged and show no signs of concern.',
  },
  neurodevelopment: {
    intro: 'Neurodevelopmental screening evaluates your child\'s cognitive, social, and behavioral development. It helps identify early signs of developmental delays, autism spectrum disorder, or attention difficulties.',
    method: 'AI-Assisted Behavioral Observation',
    healthyMessage: 'Your child\'s neurodevelopmental screening shows age-appropriate development across all domains assessed.',
  },
  immunization: {
    intro: 'Immunization review checks whether your child has received all age-appropriate vaccinations according to the national immunization schedule. Vaccines are the most effective way to protect children from serious infectious diseases.',
    method: 'Record Review',
    healthyMessage: 'Your child\'s immunization records show all age-appropriate vaccinations are up to date.',
  },
  cardiac: {
    intro: 'Cardiac auscultation listens to your child\'s heart sounds at multiple chest positions to detect murmurs, irregular rhythms, or other abnormalities. While some heart murmurs in children are harmless (innocent murmurs), others may indicate structural heart problems.',
    method: 'AI-Assisted Digital Auscultation',
    healthyMessage: 'Your child\'s heart sounds are normal with no murmurs or rhythm abnormalities detected.',
  },
  pulmonary: {
    intro: 'Pulmonary auscultation listens to lung sounds across multiple positions on the chest and back. It helps detect conditions like pneumonia, bronchitis, asthma, and other respiratory problems.',
    method: 'AI-Assisted Digital Auscultation',
    healthyMessage: 'Your child\'s lung sounds are clear and normal across all areas assessed.',
  },
}

// ─── Per-Condition Parent Info ───────────────────────────────────

export interface ConditionParentInfo {
  description: string     // Parent-friendly explanation
  prevalence?: string     // General prevalence context
  intervention: string    // Actionable guidance
  symptoms?: string       // What to watch for
  warningSign?: string    // When to seek immediate help
}

export const CONDITION_PARENT_INFO: Record<string, ConditionParentInfo> = {
  // === DEFECTS (Congenital/Structural) ===
  def1: {
    description: 'A cleft lip or palate is an opening in the upper lip or the roof of the mouth that occurs during early development. It can affect feeding, speech development, and dental health.',
    prevalence: 'Affects approximately 1 in 700 children worldwide.',
    intervention: 'We recommend consultation with a craniofacial specialist. Surgical repair is typically performed between 3-12 months of age with excellent outcomes.',
    symptoms: 'Difficulty feeding, nasal-sounding speech, frequent ear infections, dental problems.',
    warningSign: 'If your child has trouble breathing, persistent ear infections, or significant feeding difficulties, seek medical attention promptly.',
  },
  def2: {
    description: 'Down syndrome is a genetic condition caused by an extra chromosome. Children with Down syndrome may have characteristic facial features, developmental delays, and may be at higher risk for heart and thyroid conditions.',
    prevalence: 'Occurs in approximately 1 in 700 live births.',
    intervention: 'Early intervention programs including speech therapy, physical therapy, and educational support can significantly help your child\'s development. Regular cardiac and thyroid checkups are recommended.',
  },
  def3: {
    description: 'Hydrocephalus is a buildup of fluid in the brain that can increase pressure inside the skull. If untreated, it can cause developmental delays.',
    prevalence: 'Affects approximately 1-2 per 1,000 births.',
    intervention: 'Please see a pediatric neurosurgeon for evaluation. Treatment typically involves placement of a shunt to drain excess fluid.',
  },
  def4: {
    description: 'Screening suggests a possible structural heart condition based on abnormal heart sounds or other indicators. Many childhood heart murmurs are harmless, but some require further evaluation.',
    prevalence: 'Congenital heart defects affect about 1 in 100 children.',
    intervention: 'We recommend an echocardiogram (heart ultrasound) with a pediatric cardiologist to determine if the finding is significant.',
    symptoms: 'Rapid breathing, bluish skin color, poor weight gain, sweating during feeding, fatigue during physical activity.',
    warningSign: 'Seek emergency care if your child shows blue lips or fingertips, sudden difficulty breathing, or fainting during activity.',
  },
  def5: {
    description: 'Clubfoot is a condition where the foot is turned inward and downward at birth. With proper treatment, most children achieve normal walking ability.',
    prevalence: 'Occurs in approximately 1 in 1,000 births.',
    intervention: 'The Ponseti method (gentle casting and stretching) is highly effective when started early. Please consult a pediatric orthopedic specialist.',
  },
  def6: {
    description: 'Spina bifida is a condition where the spine does not fully close during development. Severity ranges widely — some cases are mild with no symptoms, while others may affect mobility.',
    prevalence: 'Affects about 1 in 2,500 births.',
    intervention: 'Consult a pediatric neurosurgeon for evaluation. Folic acid supplementation before and during pregnancy can help prevent this condition in future pregnancies.',
  },
  def7: {
    description: 'A neural tube defect is a condition where the brain or spinal cord doesn\'t develop properly during early pregnancy.',
    prevalence: 'Varies by region; preventable with folic acid supplementation.',
    intervention: 'Please consult a pediatric neurologist for evaluation and management plan.',
  },
  def8: {
    description: 'Polydactyly means your child has extra fingers or toes. This is usually an isolated finding and does not indicate other health problems.',
    prevalence: 'Occurs in about 1 in 500-1,000 births.',
    intervention: 'Surgical removal is typically done in the first year of life if the extra digit interferes with function. Consult a pediatric hand or foot surgeon.',
  },
  def9: {
    description: 'Iris coloboma is a gap in the colored part of the eye (iris), giving it a keyhole appearance. It may affect vision depending on its size and location.',
    prevalence: 'Rare, affecting approximately 1 in 10,000 children.',
    intervention: 'An ophthalmology evaluation is recommended to assess visual impact and check for associated conditions.',
  },
  def10: {
    description: 'A high-arched palate is when the roof of the mouth is higher and narrower than usual. It may cause feeding difficulties in infants and dental crowding later.',
    prevalence: 'Often associated with genetic syndromes but can occur in isolation.',
    intervention: 'Dental evaluation recommended. Orthodontic intervention may be needed as permanent teeth develop.',
  },
  def11: {
    description: 'Webbed neck refers to excess skin on the sides of the neck. It may be associated with certain genetic conditions.',
    prevalence: 'Uncommon; often associated with Turner syndrome in girls.',
    intervention: 'Genetic evaluation recommended to rule out associated conditions. Chromosomal testing may be advised.',
  },
  def12: {
    description: 'Tongue tie occurs when the band of tissue under the tongue is too short or tight, limiting tongue movement. It can affect breastfeeding in infants and speech in older children.',
    prevalence: 'Affects approximately 4-11% of newborns.',
    intervention: 'A simple procedure (frenotomy) can release the tongue tie if it is causing feeding or speech difficulties. Consult your pediatrician or a pediatric ENT specialist.',
  },

  // === DELAY (Developmental) ===
  del1: {
    description: 'Your child shows signs of delayed speech or language development compared to other children their age. This may affect how they communicate, understand instructions, or interact with others.',
    prevalence: 'Speech and language delays affect approximately 5-10% of preschool children.',
    intervention: 'A hearing test should be done first to rule out hearing loss. Speech-language therapy can be highly effective — we recommend referral to a speech-language pathologist.',
  },
  del2: {
    description: 'Your child shows signs of delayed gross motor development, such as sitting, standing, or walking later than expected. This may indicate a need for physical support.',
    prevalence: 'Gross motor delays are observed in about 5% of children.',
    intervention: 'Pediatric physical therapy is recommended. An evaluation by a developmental pediatrician can identify the underlying cause and create a tailored therapy plan.',
  },
  del3: {
    description: 'Fine motor delay affects skills like grasping objects, drawing, using scissors, and handwriting. These skills are important for school readiness and daily self-care.',
    prevalence: 'Fine motor difficulties are common, affecting up to 6% of school-age children.',
    intervention: 'Occupational therapy can help improve fine motor skills. Practice at home with activities like building with blocks, drawing, and playing with clay.',
  },
  del4: {
    description: 'Cognitive delay means your child is learning and problem-solving at a pace slower than expected for their age. Early support can make a significant difference.',
    prevalence: 'Cognitive delays are identified in approximately 1-3% of children.',
    intervention: 'A formal developmental assessment is recommended. Early intervention programs with educational support and therapy can significantly improve outcomes.',
  },
  del5: {
    description: 'Your child shows difficulty with age-appropriate self-care tasks like dressing, eating independently, or toileting. This is called adaptive behavior delay.',
    prevalence: 'Often co-occurs with other developmental delays.',
    intervention: 'Occupational therapy and structured teaching of daily living skills can help. A developmental pediatrician can create a comprehensive intervention plan.',
  },
  del6: {
    description: 'Your child shows reduced social interaction and a preference for being alone. This may indicate social-emotional development needs or could be an early sign of autism spectrum disorder.',
    prevalence: 'Social withdrawal is a common early indicator that warrants evaluation.',
    intervention: 'A developmental screening for autism spectrum disorder is recommended. Early behavioral therapy and social skills groups can be very beneficial.',
  },

  // === DISABILITY ===
  dis1: {
    description: 'Cerebral palsy is a movement disorder caused by brain differences that occurred before, during, or shortly after birth. It affects muscle tone, coordination, and movement.',
    prevalence: 'Affects approximately 2-3 per 1,000 children.',
    intervention: 'A multidisciplinary team (neurologist, physical therapist, occupational therapist) provides the best support. Early intervention significantly improves mobility and function.',
  },
  dis2: {
    description: 'Your child shows signs of intellectual disability, which affects learning ability and adaptive functioning. With proper support, children with intellectual disability can make meaningful progress.',
    prevalence: 'Affects approximately 1-3% of the population.',
    intervention: 'Comprehensive educational support, special education services, and therapy programs are recommended. A psychoeducational evaluation will help identify specific strengths and needs.',
  },
  dis3: {
    description: 'Autism spectrum disorder (ASD) affects how children communicate, interact socially, and process information. Every child with autism is unique — some need significant support while others need minimal assistance.',
    prevalence: 'Affects approximately 1 in 100 children worldwide.',
    intervention: 'Early behavioral therapy (ABA, speech therapy, social skills training) is most effective when started early. Connect with a developmental pediatrician for a comprehensive evaluation.',
  },
  dis4: {
    description: 'Hearing loss can range from mild (difficulty hearing soft sounds) to profound (unable to hear most sounds). Even mild hearing loss can significantly impact speech, language, and learning.',
    prevalence: 'Affects approximately 1-3 per 1,000 newborns; more common in school-age children due to ear infections.',
    intervention: 'A full audiological evaluation is recommended. Depending on the type and degree of loss, hearing aids, medical treatment, or speech therapy may be needed.',
  },
  dis5: {
    description: 'Vision impairment means your child\'s eyesight cannot be fully corrected with standard glasses. This includes conditions like nearsightedness, farsightedness, and amblyopia (lazy eye).',
    prevalence: 'Vision problems affect approximately 5-10% of preschool children.',
    intervention: 'A comprehensive eye examination by a pediatric ophthalmologist is recommended. Many childhood vision problems are highly treatable if caught early, especially amblyopia (before age 7-8).',
  },
  dis6: {
    description: 'Scoliosis is a sideways curvature of the spine. In children, it\'s usually painless and often detected during routine screening. Most cases are mild and only need monitoring.',
    prevalence: 'Mild scoliosis affects 2-3% of adolescents; significant curves occur in about 0.3%.',
    intervention: 'Regular monitoring with your pediatrician is recommended. If the curve is significant (>20 degrees), referral to an orthopedic specialist for potential bracing may be needed.',
  },

  // === DEFICIENCY (Nutritional) ===
  defc1: {
    description: 'Severe acute malnutrition means your child is significantly underweight and may have visible wasting (very thin arms and legs) or swelling. This is a serious condition that requires immediate treatment.',
    prevalence: 'Affects millions of children globally, particularly in low-resource settings.',
    intervention: 'Immediate medical attention is required. Your child needs therapeutic feeding under medical supervision. Please visit the nearest health center as soon as possible.',
  },
  defc2: {
    description: 'Moderate acute malnutrition means your child is underweight and not getting enough nutrition. With proper dietary support, children recover well.',
    prevalence: 'Common in developing countries; affects both undernourished and over-processed-food diets.',
    intervention: 'Nutritional counseling and supplementary feeding is recommended. Increase protein-rich foods (eggs, lentils, milk) and energy-dense foods in your child\'s diet.',
  },
  defc3: {
    description: 'Signs of anemia were detected, which means your child may have low levels of red blood cells. Common symptoms include tiredness, pale skin, and poor concentration.',
    prevalence: 'Iron deficiency anemia affects approximately 20-40% of children in developing countries.',
    intervention: 'A blood test to confirm anemia is recommended. If confirmed, iron supplements and iron-rich foods (spinach, red meat, beans, fortified cereals) can effectively treat this condition.',
  },
  defc4: {
    description: 'Micronutrient deficiency means your child may be lacking essential vitamins or minerals like iron, zinc, or vitamin A, which are critical for growth and immune function.',
    prevalence: 'Micronutrient deficiencies are widespread among children globally.',
    intervention: 'A balanced diet rich in fruits, vegetables, whole grains, and protein is key. Your pediatrician may recommend specific vitamin or mineral supplements.',
  },
  defc5: {
    description: 'An enlarged thyroid gland (goiter) was detected, which is commonly caused by iodine deficiency. The thyroid gland controls metabolism and is important for brain development.',
    prevalence: 'Common in regions with iodine-poor soil; preventable with iodized salt.',
    intervention: 'Ensure your family uses iodized salt for cooking. A thyroid function test is recommended to check if the gland is working properly.',
  },
  defc6: {
    description: 'Dental fluorosis causes white or brown marks on teeth due to excess fluoride exposure during tooth development. It is primarily a cosmetic concern and does not affect tooth function.',
    prevalence: 'Common in areas with high natural fluoride in drinking water.',
    intervention: 'Check your drinking water fluoride levels. Use age-appropriate amounts of fluoride toothpaste. Cosmetic dental treatment may help for moderate-severe cases.',
  },
  defc7: {
    description: 'Dry, scaly skin (ichthyosis) was detected, which may indicate vitamin A deficiency or a genetic skin condition. Proper treatment usually resolves symptoms.',
    prevalence: 'Vitamin A deficiency affects millions of children in developing countries.',
    intervention: 'Increase vitamin A-rich foods in your child\'s diet (carrots, sweet potatoes, leafy greens, eggs). Moisturizing creams can help with skin symptoms. Vitamin A supplementation may be recommended.',
  },
  defc8: {
    description: 'Spoon-shaped nails (koilonychia) were detected, which is strongly associated with iron deficiency anemia. The nails become concave instead of slightly convex.',
    prevalence: 'Directly linked to iron deficiency, which is the most common nutritional deficiency in children.',
    intervention: 'A blood test to check iron levels is recommended. Iron-rich foods and supplements typically resolve this condition within a few months.',
  },

  // === BEHAVIORAL / MENTAL HEALTH ===
  beh1: {
    description: 'Signs of attention deficit/hyperactivity (ADHD-like symptoms) were observed, including difficulty sustaining attention, excessive activity, or acting without thinking. Many children show some of these behaviors, but when they persist and interfere with daily activities, evaluation is helpful.',
    prevalence: 'ADHD affects approximately 5-7% of children worldwide.',
    intervention: 'A comprehensive behavioral evaluation is recommended. Treatment may include behavioral therapy, classroom accommodations, and in some cases medication. Consistent routines and positive reinforcement at home are very helpful.',
  },
  beh2: {
    description: 'Your child shows signs of excessive worry or anxiety. Children with anxiety may avoid certain situations, have trouble sleeping, or complain of stomachaches and headaches.',
    prevalence: 'Anxiety disorders affect approximately 7% of children.',
    intervention: 'Cognitive-behavioral therapy (CBT) is highly effective for childhood anxiety. Creating a supportive, predictable environment at home helps. Consult a child psychologist if symptoms persist.',
  },
  beh3: {
    description: 'Signs of low mood or depression were observed. In children, depression often shows as irritability rather than sadness, along with changes in sleep, appetite, or interest in activities.',
    prevalence: 'Depression affects approximately 2% of children and 5-8% of adolescents.',
    intervention: 'Professional support from a child psychologist or psychiatrist is recommended. Therapy (CBT or play therapy for younger children) is the first-line treatment. Maintaining social activities and physical exercise also helps.',
  },
  beh4: {
    description: 'Your child shows a pattern of defiant or oppositional behavior toward authority figures. While some defiance is normal in development, persistent patterns may need professional support.',
    prevalence: 'Oppositional behavior patterns are seen in approximately 3-5% of children.',
    intervention: 'Parent management training and behavioral therapy are most effective. Consistent boundaries with positive reinforcement work better than punishment. Consult a child behavioral specialist.',
  },
  beh5: {
    description: 'Conduct concerns involve persistent patterns of behavior that may include aggression, rule-breaking, or disregard for others\' rights, beyond what is typical for the child\'s age.',
    prevalence: 'Conduct issues affect approximately 2-5% of children.',
    intervention: 'Early intervention with a child psychologist is important. Family therapy and structured behavioral programs can help redirect behavior patterns.',
  },
  beh6: {
    description: 'Your child appears to be having difficulty adjusting to a recent life change or stressful event. This is an adjustment reaction that usually improves with support and time.',
    prevalence: 'Common in children experiencing major life changes (new school, family changes, loss).',
    intervention: 'Provide extra emotional support and maintain routines. If symptoms persist beyond 3-6 months, consult a child counselor. Reassure your child that their feelings are normal.',
  },
  beh7: {
    description: 'Emotional regulation difficulties were observed, including intense emotional reactions, rapid mood changes, or difficulty recovering from emotional upsets.',
    prevalence: 'Emotional regulation challenges are common and often improve with age and support.',
    intervention: 'Help your child identify and name emotions. Teach calming strategies (deep breathing, counting). If difficulties persist, a child therapist can teach coping skills.',
  },
  beh8: {
    description: 'Excessive screen time and digital device dependency is affecting your child\'s daily functioning, including sleep, physical activity, social interactions, or academic performance.',
    prevalence: 'Digital dependency is an increasing concern among school-age children globally.',
    intervention: 'Set clear screen time limits (recommended: max 1-2 hours for ages 6+, less for younger). Create device-free zones (bedroom, dinner table). Encourage physical outdoor play and face-to-face social activities.',
  },

  // === IMMUNIZATION ===
  imz1: {
    description: 'Your child has received all recommended vaccinations for their age. Vaccines are the best way to protect your child from serious diseases.',
    intervention: 'Continue following the national immunization schedule. Keep vaccination records safe for school enrollment and future reference.',
  },
  imz2: {
    description: 'Your child has received some but not all recommended vaccinations. Some vaccinations are missing from the schedule.',
    prevalence: 'Partial immunization leaves children vulnerable to preventable diseases.',
    intervention: 'Please visit your nearest health center to complete the missing vaccinations. A catch-up schedule can be created to bring your child up to date safely.',
  },
  imz3: {
    description: 'Your child has not received any vaccinations. This leaves them unprotected against several serious and potentially life-threatening diseases.',
    intervention: 'Please visit your nearest health center to begin the full vaccination course. It\'s never too late to start immunizations. All recommended vaccines can be given on a catch-up schedule.',
  },
  imz4: {
    description: 'Your child\'s vaccinations are behind schedule. While some vaccines have been given, they were not given at the recommended ages.',
    intervention: 'A catch-up immunization schedule is recommended. Visit your nearest health center to get your child back on track. Delayed vaccines can still provide protection.',
  },
  imz5: {
    description: 'An adverse reaction was reported following a previous vaccination. Most vaccine reactions are mild (fever, soreness) and resolve on their own.',
    intervention: 'Please discuss the reaction with your pediatrician before the next vaccination. Your doctor will assess whether future doses should be given and may recommend pre-medication.',
  },

  // === LEARNING ===
  lrn1: {
    description: 'Signs of reading difficulty (dyslexia) were detected. Children with dyslexia have trouble with reading accuracy, fluency, and/or comprehension despite having normal intelligence.',
    prevalence: 'Dyslexia affects approximately 5-10% of school-age children.',
    intervention: 'A psychoeducational assessment is recommended. Specialized reading instruction (Orton-Gillingham method) is highly effective. Classroom accommodations like extra time and audio books can help immediately.',
  },
  lrn2: {
    description: 'Signs of math difficulty (dyscalculia) were detected. Children with dyscalculia struggle with number sense, arithmetic, and mathematical reasoning despite adequate instruction.',
    prevalence: 'Dyscalculia affects approximately 3-7% of school-age children.',
    intervention: 'A psychoeducational assessment can confirm the diagnosis. Multi-sensory math instruction and one-on-one tutoring are effective. Classroom accommodations like calculators and extra time are helpful.',
  },
  lrn3: {
    description: 'Signs of writing difficulty (dysgraphia) were detected. Children with dysgraphia have trouble with handwriting, spelling, and organizing written thoughts despite adequate motor skills.',
    prevalence: 'Dysgraphia affects approximately 5-20% of school-age children.',
    intervention: 'Occupational therapy can improve handwriting. Allowing your child to type assignments and use speech-to-text tools can reduce frustration. A psychoeducational assessment is recommended.',
  },
}

// ─── Utility: Anatomical position for body diagram ──────────────

export interface BodyPosition {
  x: number   // percentage from left (0-100)
  y: number   // percentage from top (0-100)
  label: string
}

export const MODULE_BODY_POSITIONS: Partial<Record<ModuleType, BodyPosition>> = {
  hair:               { x: 50, y: 5,  label: 'Hair & Scalp' },
  eyes_external:      { x: 38, y: 14, label: 'Eyes' },
  vision:             { x: 62, y: 14, label: 'Vision' },
  ear:                { x: 25, y: 17, label: 'Ears' },
  hearing:            { x: 75, y: 17, label: 'Hearing' },
  nose:               { x: 50, y: 18, label: 'Nose' },
  dental:             { x: 40, y: 23, label: 'Dental' },
  throat:             { x: 60, y: 23, label: 'Throat' },
  neck:               { x: 50, y: 28, label: 'Neck' },
  general_appearance: { x: 85, y: 10, label: 'General' },
  cardiac:            { x: 40, y: 38, label: 'Heart' },
  pulmonary:          { x: 60, y: 38, label: 'Lungs' },
  respiratory:        { x: 50, y: 42, label: 'Respiratory' },
  abdomen:            { x: 50, y: 52, label: 'Abdomen' },
  skin:               { x: 15, y: 50, label: 'Skin' },
  nails:              { x: 15, y: 65, label: 'Nails' },
  lymph:              { x: 85, y: 30, label: 'Lymph' },
  posture:            { x: 85, y: 50, label: 'Spine' },
  motor:              { x: 50, y: 78, label: 'Motor' },
  neurodevelopment:   { x: 85, y: 70, label: 'Neuro' },
  immunization:       { x: 15, y: 35, label: 'Immunization' },
}

// ─── Lookup Helpers ─────────────────────────────────────────────

export function getModuleEducation(moduleType: ModuleType): ModuleEducation | undefined {
  return MODULE_EDUCATION[moduleType]
}

export function getConditionInfo(conditionKey: string): ConditionParentInfo | undefined {
  return CONDITION_PARENT_INFO[conditionKey]
}
