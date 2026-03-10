/**
 * Master report content — per-module overview + per-condition details.
 * Ported from V2's report-content.ts.
 *
 * Structure:
 *   Module → overview, icon, conditions[]
 *   Condition → name, symptoms, prevalence, prevention, care, whenToSeekHelp
 */

export interface ReportCondition {
  id: string
  name: string
  symptoms: string
  prevalence: string
  prevention: string
  care: string
  whenToSeekHelp: string
}

export interface ModuleReportContent {
  label: string
  icon: string
  overview: string
  method: string
  healthyMessage: string
  conditions: ReportCondition[]
}

export const REPORT_CONTENT: Record<string, ModuleReportContent> = {

  // ═══ HEAD-TO-TOE ═══

  hair: {
    label: 'Hair & Scalp',
    icon: '\u{1F9D2}',
    overview: 'Hair health in children can be an indicator of nutrition, hygiene, and overall well-being. Common issues include scalp infections, hair thinning, and conditions like alopecia areata.',
    method: 'Visual Screening',
    healthyMessage: 'Your child\'s hair and scalp appear healthy with no signs of infection or abnormality.',
    conditions: [
      {
        id: 'dandruff',
        name: 'Dandruff',
        symptoms: 'White or yellow flakes on the scalp, itching, dry scalp.',
        prevalence: 'Affects about 30% of school-going children in India.',
        prevention: 'Regular hair washing with mild shampoo, ensuring proper scalp hygiene.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include anti-dandruff shampoos, improving scalp hygiene, and using medicated oils.',
        whenToSeekHelp: 'If the dandruff persists, or the child experiences hair loss or intense itching.',
      },
      {
        id: 'head_lice',
        name: 'Head Lice',
        symptoms: 'Itching, visible lice or eggs (nits) on the scalp.',
        prevalence: 'Common in school-age children, affecting up to 40% of children in crowded environments.',
        prevention: 'Regular hair washing, avoiding sharing personal items like combs, and keeping the scalp clean.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include medicated shampoos, combing out lice/nits, and home treatment.',
        whenToSeekHelp: 'If home treatment does not remove the lice or if the child shows signs of infection (red, swollen scalp).',
      },
      {
        id: 'alopecia_areata',
        name: 'Alopecia Areata',
        symptoms: 'Sudden hair loss in patches on the scalp.',
        prevalence: 'Affects approximately 2-5% of children in India.',
        prevention: 'There are no guaranteed prevention methods, but maintaining a healthy diet and proper scalp care may help.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include treatment options like topical medications or steroids.',
        whenToSeekHelp: 'If hair loss becomes widespread or if the child experiences emotional distress due to the condition.',
      },
    ],
  },

  eyes_external: {
    label: 'Eyes',
    icon: '\u{1F441}',
    overview: 'Eyes are essential for a child\'s development, influencing learning and everyday activities. Common pediatric eye issues include refractive errors, conjunctivitis, and amblyopia.',
    method: 'AI-Assisted Imaging',
    healthyMessage: 'Your child\'s external eye examination shows no abnormalities.',
    conditions: [
      {
        id: 'conjunctivitis',
        name: 'Conjunctivitis (Pink Eye)',
        symptoms: 'Redness, itching, discharge, swollen eyelids, or sensitivity to light.',
        prevalence: 'Common in school-aged children in India.',
        prevention: 'Hand hygiene, avoiding face touching, and not sharing personal items.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include medication, and keeping the eyes clean.',
        whenToSeekHelp: 'If symptoms persist, or if there is pain, vision problems, or a high fever.',
      },
      {
        id: 'stye',
        name: 'Stye / Chalazion',
        symptoms: 'Red, swollen bump on the eyelid, tenderness, tearing.',
        prevalence: 'Affects about 5-8% of school-age children.',
        prevention: 'Good eye hygiene, avoid rubbing eyes, and regular hand washing.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Warm compresses and proper eyelid hygiene usually resolve the condition.',
        whenToSeekHelp: 'If the bump doesn\'t resolve in 1-2 weeks, affects vision, or the entire eyelid becomes swollen.',
      },
    ],
  },

  vision: {
    label: 'Vision',
    icon: '\u{1F453}',
    overview: 'Vision screening checks for conditions that may affect your child\'s ability to see clearly. Early detection is critical because untreated conditions like amblyopia can become permanent if not caught before age 7-8.',
    method: 'AI-Assisted Photoscreening',
    healthyMessage: 'Your child\'s vision screening results are within normal range.',
    conditions: [
      {
        id: 'refractive_errors',
        name: 'Refractive Errors (Myopia, Hyperopia, Astigmatism)',
        symptoms: 'Blurry vision, squinting, difficulty seeing distant or close objects.',
        prevalence: 'Affects 10-20% of children in India.',
        prevention: 'Regular eye checkups, reduced screen time, and proper lighting for reading.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include glasses, reducing screen time, more outdoor activity, and regular eye check-ups.',
        whenToSeekHelp: 'Sudden changes in vision, frequent headaches, or eye strain.',
      },
      {
        id: 'amblyopia',
        name: 'Amblyopia (Lazy Eye)',
        symptoms: 'Reduced vision in one eye, poor depth perception.',
        prevalence: 'Affects 1-2% of children in India.',
        prevention: 'Early eye screenings and treatment of vision problems in infants and toddlers.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include vision therapy or corrective lenses.',
        whenToSeekHelp: 'If vision does not improve despite treatment.',
      },
      {
        id: 'strabismus',
        name: 'Strabismus (Squint)',
        symptoms: 'Eyes do not align properly, one eye turns inward/outward.',
        prevalence: 'Affects about 3-5% of children.',
        prevention: 'Early vision screenings in infancy.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Treatment may include corrective glasses, eye patches, or surgery.',
        whenToSeekHelp: 'If the child\'s eyes appear misaligned consistently, or if they tilt their head to see.',
      },
    ],
  },

  ear: {
    label: 'Ear',
    icon: '\u{1F442}',
    overview: 'The ears are vital for hearing and balance. Common ear-related conditions include ear infections, impacted earwax, and hearing loss, which can impact language development.',
    method: 'AI-Assisted Otoscopy',
    healthyMessage: 'Your child\'s ear examination shows healthy ear canals and eardrums with no signs of infection or fluid.',
    conditions: [
      {
        id: 'otitis_media',
        name: 'Otitis Media (Middle Ear Infection)',
        symptoms: 'Ear pain, fever, irritability, trouble hearing, or discharge from the ear.',
        prevalence: 'Affects around 7-10% of children under 5 years in India.',
        prevention: 'Ensure good hygiene, vaccinate against the flu, and avoid second-hand smoke exposure.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include antibiotic treatment, ear drops, or monitoring for fluid buildup.',
        whenToSeekHelp: 'If the child has persistent pain, high fever, or hearing difficulties.',
      },
      {
        id: 'cerumen_impaction',
        name: 'Impacted Earwax',
        symptoms: 'Earache, difficulty hearing, or a feeling of fullness in the ear.',
        prevalence: 'Affects approximately 10-15% of children.',
        prevention: 'Regular ear hygiene, avoiding the use of cotton swabs or other objects in the ear canal.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include ear irrigation or removal by a healthcare professional.',
        whenToSeekHelp: 'If the child experiences pain, hearing loss, or blockage despite home care.',
      },
    ],
  },

  hearing: {
    label: 'Hearing',
    icon: '\u{1F50A}',
    overview: 'Hearing screening assesses your child\'s ability to hear sounds at different frequencies. Even mild hearing loss can significantly impact speech development, learning, and social interaction.',
    method: 'Audiometric Screening',
    healthyMessage: 'Your child\'s hearing appears normal across all tested frequencies.',
    conditions: [
      {
        id: 'hearing_loss',
        name: 'Hearing Loss',
        symptoms: 'Delayed speech development, inattentiveness, difficulty understanding speech, or loud speech.',
        prevalence: 'Estimated to affect 6 out of every 1,000 children in India.',
        prevention: 'Early screening, regular hearing checkups, and protecting the child\'s ears from loud noises.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include hearing aids, speech therapy, or cochlear implants in severe cases.',
        whenToSeekHelp: 'If the child shows signs of hearing difficulties or speech delays.',
      },
      {
        id: 'tinnitus',
        name: 'Tinnitus (Ringing in Ears)',
        symptoms: 'Persistent ringing, buzzing, or humming sounds in the ears.',
        prevalence: 'Reported in about 6-13% of school-age children.',
        prevention: 'Limit exposure to loud music/sounds, use ear protection in noisy environments.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Underlying causes like ear infections or wax buildup should be addressed.',
        whenToSeekHelp: 'If the ringing is persistent, affects concentration, or is accompanied by hearing loss.',
      },
    ],
  },

  nose: {
    label: 'Nose',
    icon: '\u{1F443}',
    overview: 'Nasal examination checks for conditions like deviated septum, polyps, chronic congestion, and allergic rhinitis. Nasal obstruction can affect breathing, sleep, and overall quality of life.',
    method: 'AI-Assisted Visual Screening',
    healthyMessage: 'Your child\'s nasal examination shows no abnormalities or signs of obstruction.',
    conditions: [
      {
        id: 'allergic_rhinitis',
        name: 'Allergic Rhinitis',
        symptoms: 'Sneezing, runny or stuffy nose, itchy eyes and nose.',
        prevalence: 'Affects approximately 20-30% of children in India.',
        prevention: 'Avoid known allergens like dust, pollen, and pet dander. Use air purifiers indoors.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Treatment may include antihistamines, nasal sprays, or allergy testing.',
        whenToSeekHelp: 'If symptoms interfere with sleep, school performance, or are persistent year-round.',
      },
      {
        id: 'nasal_polyps',
        name: 'Nasal Polyps',
        symptoms: 'Blocked nose, reduced sense of smell, mouth breathing, snoring.',
        prevalence: 'Uncommon in young children, more common in adolescents with chronic allergies.',
        prevention: 'Managing underlying allergies and avoiding irritants.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Treatment may include nasal corticosteroids or surgery in severe cases.',
        whenToSeekHelp: 'If the child has persistent nasal blockage, snoring, or recurrent sinus infections.',
      },
    ],
  },

  dental: {
    label: 'Dental',
    icon: '\u{1F9B7}',
    overview: 'Dental health is critical for a child\'s overall well-being, particularly for nutrition and speech. Common issues include cavities, gum diseases, and dental malocclusion.',
    method: 'AI-Assisted Imaging & Video',
    healthyMessage: 'Your child\'s dental examination shows healthy teeth and gums with no cavities or significant concerns.',
    conditions: [
      {
        id: 'dental_caries',
        name: 'Dental Caries (Cavities)',
        symptoms: 'Toothache, visible holes or pits in teeth, sensitivity to hot, cold, or sweet foods.',
        prevalence: 'Affects around 60% of children in India.',
        prevention: 'Encourage brushing twice a day, limit sugary foods and drinks, and regular dental check-ups.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include fillings, fluoride treatments, and improved dental hygiene practices.',
        whenToSeekHelp: 'If the child complains of tooth pain, visible decay, or has trouble eating.',
      },
      {
        id: 'gingivitis',
        name: 'Gingivitis (Gum Disease)',
        symptoms: 'Swollen, red gums that may bleed when brushing or flossing.',
        prevalence: 'Affects approximately 15-20% of children in India.',
        prevention: 'Proper brushing and flossing habits, regular dental check-ups.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include professional cleaning, improved oral hygiene, and in severe cases, medication.',
        whenToSeekHelp: 'If the child\'s gums bleed frequently or are swollen and tender.',
      },
      {
        id: 'malocclusion',
        name: 'Malocclusion (Misaligned Teeth)',
        symptoms: 'Crowded teeth, difficulty chewing, or biting, misaligned jaw.',
        prevalence: 'Affects around 15% of children in India.',
        prevention: 'Early dental screenings and orthodontic evaluation.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include braces, retainers, or other orthodontic treatments.',
        whenToSeekHelp: 'If the child has difficulty chewing or noticeable misalignment of teeth.',
      },
    ],
  },

  throat: {
    label: 'Throat',
    icon: '\u{1FA7A}',
    overview: 'Throat health is important for swallowing, breathing, and vocalization. Common conditions include tonsillitis, pharyngitis, and laryngitis.',
    method: 'AI-Assisted Video Screening',
    healthyMessage: 'Your child\'s throat examination shows normal tonsils and pharynx with no signs of infection.',
    conditions: [
      {
        id: 'tonsillitis',
        name: 'Tonsillitis',
        symptoms: 'Sore throat, difficulty swallowing, fever, swollen tonsils, bad breath.',
        prevalence: 'Affects around 5-7% of children under 10 in India.',
        prevention: 'Good hygiene practices like handwashing, avoiding close contact with sick individuals.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include antibiotic treatment for bacterial tonsillitis or throat gargles for comfort.',
        whenToSeekHelp: 'If the child has difficulty breathing, severe pain, or recurring infections.',
      },
      {
        id: 'pharyngitis',
        name: 'Pharyngitis (Sore Throat)',
        symptoms: 'Pain or scratchiness in the throat, difficulty swallowing, red or swollen throat.',
        prevalence: 'Affects around 15-20% of children annually.',
        prevention: 'Promote hygiene like frequent handwashing and avoiding sharing utensils.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include throat lozenges, increased hydration, and medication for pain relief.',
        whenToSeekHelp: 'If the sore throat is accompanied by high fever, difficulty breathing, or symptoms persist for more than a few days.',
      },
    ],
  },

  neck: {
    label: 'Neck & Thyroid',
    icon: '\u{1F9EC}',
    overview: 'Neck and thyroid examination checks for enlarged lymph nodes, thyroid gland abnormalities, and other neck masses.',
    method: 'Visual & Video Screening',
    healthyMessage: 'Your child\'s neck examination shows no enlarged lymph nodes or thyroid abnormalities.',
    conditions: [
      {
        id: 'goiter',
        name: 'Goiter (Thyroid Enlargement)',
        symptoms: 'Visible swelling at the base of the neck, difficulty swallowing, hoarseness.',
        prevalence: 'Common in iodine-deficient regions of India.',
        prevention: 'Ensure family uses iodized salt for cooking.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Thyroid function tests are recommended.',
        whenToSeekHelp: 'If neck swelling is increasing, or child shows signs of thyroid dysfunction (fatigue, weight changes).',
      },
      {
        id: 'cervical_lymphadenopathy',
        name: 'Enlarged Cervical Lymph Nodes',
        symptoms: 'Palpable lumps in the neck, tenderness, fever.',
        prevalence: 'Very common — most often due to infections, seen in up to 40% of healthy children.',
        prevention: 'Good hygiene, prompt treatment of throat and ear infections.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Most cases resolve with treatment of the underlying infection.',
        whenToSeekHelp: 'If lymph nodes are persistently enlarged (>2 weeks), hard, or fixed to surrounding tissue.',
      },
    ],
  },

  cardiac: {
    label: 'Heart',
    icon: '\u{2764}',
    overview: 'Heart conditions in children can range from congenital heart defects to acquired conditions like rheumatic heart disease. Early detection is key.',
    method: 'AI-Assisted Digital Auscultation',
    healthyMessage: 'Your child\'s heart sounds are normal with no murmurs or rhythm abnormalities detected.',
    conditions: [
      {
        id: 'congenital_heart',
        name: 'Congenital Heart Defects (CHD)',
        symptoms: 'Rapid breathing, poor feeding, blue tint to skin (cyanosis), poor weight gain.',
        prevalence: 'Affects 8-10 children per 1,000 live births in India.',
        prevention: 'Not preventable, but early detection through screening can improve outcomes.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include medication or surgical intervention.',
        whenToSeekHelp: 'If the child experiences rapid breathing, fainting, or bluish skin.',
      },
      {
        id: 'rheumatic_heart',
        name: 'Rheumatic Heart Disease',
        symptoms: 'Shortness of breath, fatigue, chest pain, joint pain, fever.',
        prevalence: 'Affects about 0.3% of school-age children in India.',
        prevention: 'Timely treatment of streptococcal throat infections, regular medical follow-ups.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include long-term medications or surgery.',
        whenToSeekHelp: 'If the child has recurrent sore throats, joint pain, or signs of heart trouble like breathlessness.',
      },
      {
        id: 'heart_murmur',
        name: 'Heart Murmurs',
        symptoms: 'Generally asymptomatic, detected during routine checkups.',
        prevalence: 'Around 1% of children in India are diagnosed with heart murmurs; most are innocent.',
        prevention: 'Regular health checkups to monitor heart function.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Most heart murmurs are harmless and require no treatment.',
        whenToSeekHelp: 'If the child shows signs of fatigue, poor growth, or breathing difficulties.',
      },
    ],
  },

  pulmonary: {
    label: 'Lungs',
    icon: '\u{1FAC1}',
    overview: 'Lung health in children is critical, especially in India where air pollution and respiratory infections are common.',
    method: 'AI-Assisted Digital Auscultation',
    healthyMessage: 'Your child\'s lung sounds are clear and normal across all areas assessed.',
    conditions: [
      {
        id: 'asthma',
        name: 'Asthma',
        symptoms: 'Wheezing, coughing, shortness of breath, chest tightness.',
        prevalence: 'Affects approximately 10-15% of children in India.',
        prevention: 'Avoid triggers like allergens, air pollution, and smoking.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include inhalers and medication.',
        whenToSeekHelp: 'If the child has difficulty breathing, frequent coughing, or an asthma attack.',
      },
      {
        id: 'pneumonia',
        name: 'Pneumonia',
        symptoms: 'Cough, fever, difficulty breathing, chest pain.',
        prevalence: 'Affects approximately 370,000 children annually in India.',
        prevention: 'Vaccination, good nutrition, and reducing exposure to pollution.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include antibiotics and hospitalization in severe cases.',
        whenToSeekHelp: 'If the child has trouble breathing, high fever, or bluish lips/skin.',
      },
      {
        id: 'bronchitis',
        name: 'Bronchitis',
        symptoms: 'Persistent cough, wheezing, shortness of breath.',
        prevalence: 'Affects around 8-10% of children, especially during the cold season.',
        prevention: 'Avoid exposure to tobacco smoke and other pollutants.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include cough medications and ensuring proper hydration.',
        whenToSeekHelp: 'If symptoms persist for more than a week, or if the child has breathing difficulty.',
      },
    ],
  },

  respiratory: {
    label: 'Respiratory',
    icon: '\u{1F4A8}',
    overview: 'Respiratory screening uses audio technology to listen to lung sounds and detect abnormal breathing patterns.',
    method: 'AI-Assisted Audio Analysis',
    healthyMessage: 'Your child\'s respiratory sounds are clear and normal with no signs of wheezing or congestion.',
    conditions: [
      {
        id: 'wheeze',
        name: 'Wheezing / Reactive Airway',
        symptoms: 'High-pitched whistling sound when breathing, especially during exhalation.',
        prevalence: 'Up to 30% of children experience at least one episode of wheezing before age 3.',
        prevention: 'Reduce exposure to smoke, allergens, and cold air.',
        care: 'Consult your SKIDS pediatrician for further evaluation. A bronchodilator trial may help determine the underlying cause.',
        whenToSeekHelp: 'If wheezing is recurrent, accompanied by difficulty breathing, or the child\'s lips turn blue.',
      },
    ],
  },

  abdomen: {
    label: 'Abdomen',
    icon: '\u{1F932}',
    overview: 'The abdominal area houses vital organs responsible for digestion, metabolism, and excretion.',
    method: 'Visual Screening',
    healthyMessage: 'Your child\'s abdominal examination shows no abnormalities or areas of concern.',
    conditions: [
      {
        id: 'gerd',
        name: 'Gastroesophageal Reflux (GERD)',
        symptoms: 'Frequent vomiting, irritability, feeding difficulties, and coughing.',
        prevalence: 'Affects around 5-8% of infants and 1-3% of children.',
        prevention: 'Keep the child upright during and after feeding, avoid spicy and acidic foods.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include dietary changes or medications.',
        whenToSeekHelp: 'If the child has difficulty feeding, persistent vomiting, or signs of dehydration.',
      },
      {
        id: 'constipation',
        name: 'Constipation',
        symptoms: 'Infrequent bowel movements, hard stools, abdominal pain.',
        prevalence: 'Affects about 10-20% of children.',
        prevention: 'Ensure a diet high in fiber, adequate hydration, and regular physical activity.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include dietary modifications and stool softeners if necessary.',
        whenToSeekHelp: 'If the child has severe abdominal pain, blood in stools, or constipation lasting more than two weeks.',
      },
    ],
  },

  skin: {
    label: 'Skin',
    icon: '\u{1FA79}',
    overview: 'Skin health is important as it acts as a protective barrier. Common skin conditions include eczema, impetigo, and fungal infections.',
    method: 'AI-Assisted Image Segmentation',
    healthyMessage: 'Your child\'s skin appears healthy with no significant lesions, rashes, or areas of concern.',
    conditions: [
      {
        id: 'eczema',
        name: 'Eczema (Atopic Dermatitis)',
        symptoms: 'Dry, itchy skin, redness, and swelling.',
        prevalence: 'Affects about 10-20% of children in India.',
        prevention: 'Avoid known triggers, moisturize regularly, and use gentle skin products.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include topical steroids or antihistamines.',
        whenToSeekHelp: 'If the child has severe itching, infection signs, or does not respond to home care.',
      },
      {
        id: 'impetigo',
        name: 'Impetigo',
        symptoms: 'Red sores, often around the nose and mouth, that can burst and ooze.',
        prevalence: 'Affects around 2-5% of children.',
        prevention: 'Good hygiene, avoid sharing personal items, and wash cuts and abrasions.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include antibiotic ointments or oral antibiotics.',
        whenToSeekHelp: 'If sores do not heal or are spreading.',
      },
      {
        id: 'fungal_infection',
        name: 'Fungal Infections (Ringworm)',
        symptoms: 'Red, ring-shaped patches on skin, itching, flaky skin.',
        prevalence: 'Very common in hot, humid climates — affects 10-15% of school children.',
        prevention: 'Keep skin clean and dry, avoid sharing towels, wear breathable clothing.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Antifungal creams are usually effective.',
        whenToSeekHelp: 'If the infection spreads, doesn\'t improve with treatment, or is on the scalp.',
      },
    ],
  },

  nails: {
    label: 'Nails',
    icon: '\u{1F485}',
    overview: 'Nail examination can reveal signs of nutritional deficiency (iron, zinc), fungal infections, or systemic conditions.',
    method: 'Visual Screening',
    healthyMessage: 'Your child\'s nails appear healthy with no signs of nutritional deficiency or infection.',
    conditions: [
      {
        id: 'koilonychia',
        name: 'Koilonychia (Spoon Nails)',
        symptoms: 'Concave, spoon-shaped nails instead of slightly convex.',
        prevalence: 'Directly linked to iron deficiency, which affects 30-50% of children in India.',
        prevention: 'Ensure a diet rich in iron (leafy greens, meat, beans, fortified cereals).',
        care: 'Consult your SKIDS pediatrician for further evaluation. A blood test to check iron levels is recommended.',
        whenToSeekHelp: 'If nails appear abnormally shaped, or the child shows signs of anemia (fatigue, pale skin).',
      },
    ],
  },

  posture: {
    label: 'Posture & Spine',
    icon: '\u{1F9CD}',
    overview: 'Posture and spine screening checks for scoliosis, kyphosis, and other postural abnormalities. Early detection allows for monitoring and bracing.',
    method: 'AI-Assisted Visual Analysis',
    healthyMessage: 'Your child\'s posture and spine alignment appear normal with no signs of curvature.',
    conditions: [
      {
        id: 'scoliosis',
        name: 'Scoliosis',
        symptoms: 'Uneven shoulders, one shoulder blade more prominent, uneven waist, leaning to one side.',
        prevalence: 'Mild scoliosis affects 2-3% of adolescents; significant curves occur in about 0.3%.',
        prevention: 'Regular posture screening, especially during growth spurts.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Monitoring, bracing, or physiotherapy may be recommended.',
        whenToSeekHelp: 'If the child has visible spine curvature, uneven shoulders, or back pain.',
      },
      {
        id: 'kyphosis',
        name: 'Kyphosis (Rounded Back)',
        symptoms: 'Excessive forward rounding of the upper back, hunchback appearance.',
        prevalence: 'Postural kyphosis is common in adolescents, especially with heavy schoolbags.',
        prevention: 'Encourage good posture, limit heavy backpack loads, strengthening exercises.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Physical therapy and postural exercises are usually effective.',
        whenToSeekHelp: 'If the rounding is progressive, painful, or limits daily activities.',
      },
    ],
  },

  motor: {
    label: 'Motor Skills',
    icon: '\u{1F3C3}',
    overview: 'Motor assessment evaluates your child\'s ability to perform age-appropriate movements — walking, running, balance, and coordination.',
    method: 'AI-Assisted Video & Gait Analysis',
    healthyMessage: 'Your child\'s motor skills are appropriate for their age with no coordination or balance concerns.',
    conditions: [
      {
        id: 'gross_motor_delay',
        name: 'Gross Motor Delay',
        symptoms: 'Late walking, poor balance, difficulty climbing stairs, clumsiness.',
        prevalence: 'Gross motor delays are observed in about 5% of children.',
        prevention: 'Regular physical activity, tummy time in infancy, outdoor play.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Physical therapy is recommended.',
        whenToSeekHelp: 'If the child is significantly behind peers in physical milestones.',
      },
      {
        id: 'fine_motor_delay',
        name: 'Fine Motor Delay',
        symptoms: 'Difficulty grasping objects, poor handwriting, trouble using scissors.',
        prevalence: 'Fine motor difficulties affect up to 6% of school-age children.',
        prevention: 'Activities like building with blocks, drawing, and playing with clay.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Occupational therapy can help improve fine motor skills.',
        whenToSeekHelp: 'If the child struggles with age-appropriate tasks like buttoning, writing, or feeding.',
      },
    ],
  },

  lymph: {
    label: 'Lymph Nodes',
    icon: '\u{1F9E0}',
    overview: 'Lymph node examination checks for enlarged or tender lymph nodes. Lymph nodes are part of the immune system.',
    method: 'Clinical Palpation Assessment',
    healthyMessage: 'Your child\'s lymph nodes are not enlarged and show no signs of concern.',
    conditions: [
      {
        id: 'lymphadenopathy',
        name: 'Lymphadenopathy (Enlarged Lymph Nodes)',
        symptoms: 'Palpable lumps under the skin, tenderness, associated fever.',
        prevalence: 'Very common in children — most are reactive due to minor infections.',
        prevention: 'Good hygiene, prompt treatment of infections.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Most cases resolve with treatment of the underlying infection.',
        whenToSeekHelp: 'If nodes are larger than 2 cm, persist beyond 4-6 weeks, are hard, or associated with unexplained weight loss.',
      },
    ],
  },

  general_appearance: {
    label: 'General Appearance',
    icon: '\u{1F9D1}',
    overview: 'General appearance assessment evaluates your child\'s overall health presentation, including alertness, skin color, and signs of distress.',
    method: 'AI-Assisted Visual Screening',
    healthyMessage: 'Your child appears healthy with good color, alertness, and overall appearance.',
    conditions: [
      {
        id: 'failure_to_thrive',
        name: 'Failure to Thrive',
        symptoms: 'Poor weight gain, listlessness, delayed development.',
        prevalence: 'Affects approximately 5-10% of children in developing countries.',
        prevention: 'Adequate nutrition, regular growth monitoring.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Nutritional support and investigation of underlying causes is recommended.',
        whenToSeekHelp: 'If the child is not gaining weight appropriately or shows signs of developmental delay.',
      },
    ],
  },

  // ═══ VITALS ═══

  height: {
    label: 'Height',
    icon: '\u{1F4CF}',
    overview: 'Height measurement helps track your child\'s growth over time. Comparing height to WHO standards identifies children who may be growing slower or faster than expected.',
    method: 'Physical Measurement',
    healthyMessage: 'Your child\'s height is within the normal range for their age and gender.',
    conditions: [
      {
        id: 'stunting',
        name: 'Stunting (Short Stature)',
        symptoms: 'Height significantly below the WHO growth standard for age.',
        prevalence: 'Affects about 35% of children under 5 in India.',
        prevention: 'Ensure adequate nutrition especially in the first 1,000 days of life.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Nutritional counseling and investigation of underlying causes is recommended.',
        whenToSeekHelp: 'If the child\'s height is consistently below the 3rd percentile, or growth velocity has slowed significantly.',
      },
      {
        id: 'tall_stature',
        name: 'Tall Stature',
        symptoms: 'Height significantly above the WHO growth standard for age.',
        prevalence: 'Often familial, but can indicate endocrine conditions in rare cases.',
        prevention: 'Regular growth monitoring.',
        care: 'Consult your SKIDS pediatrician if growth velocity is excessive. Usually no treatment needed if familial.',
        whenToSeekHelp: 'If accompanied by early puberty signs, or growth seems disproportionate.',
      },
    ],
  },

  weight: {
    label: 'Weight',
    icon: '\u{2696}',
    overview: 'Weight measurement is essential for monitoring nutrition and overall health. It helps detect undernutrition, overnutrition, and track healthy growth patterns.',
    method: 'Physical Measurement',
    healthyMessage: 'Your child\'s weight is within the healthy range for their age and gender.',
    conditions: [
      {
        id: 'obesity',
        name: 'Obesity / Overweight',
        symptoms: 'Excess body fat, low physical activity levels, BMI above 95th percentile.',
        prevalence: 'Affects approximately 18% of children aged 5-19 in India.',
        prevention: 'Encourage a balanced diet, regular physical activity, and limit screen time.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include dietary counseling and physical activity plans.',
        whenToSeekHelp: 'If the child shows signs of related health issues like diabetes or joint problems.',
      },
      {
        id: 'underweight',
        name: 'Underweight / Malnutrition',
        symptoms: 'Low energy levels, stunted growth, fatigue, and frequent infections.',
        prevalence: 'Affects about 20% of children under five in India.',
        prevention: 'Ensure a nutritious diet, regular health checkups, and addressing underlying health issues.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include dietary supplements and addressing underlying health issues.',
        whenToSeekHelp: 'If the child shows significant weight loss or fails to gain weight appropriately.',
      },
    ],
  },

  bp: {
    label: 'Blood Pressure',
    icon: '\u{1FA78}',
    overview: 'Blood pressure screening helps detect early signs of hypertension, which can occur even in children.',
    method: 'Digital Sphygmomanometry',
    healthyMessage: 'Your child\'s blood pressure is within the healthy range for their age and height.',
    conditions: [
      {
        id: 'hypertension',
        name: 'Hypertension (High Blood Pressure)',
        symptoms: 'Usually asymptomatic; severe cases may cause headaches, blurred vision.',
        prevalence: 'Affects 2-5% of children; higher in obese children.',
        prevention: 'Healthy diet (low salt), regular exercise, maintaining healthy weight.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Lifestyle modifications are first-line; medication in severe cases.',
        whenToSeekHelp: 'If BP readings are consistently elevated on multiple visits.',
      },
    ],
  },

  hemoglobin: {
    label: 'Hemoglobin / Anemia',
    icon: '\u{1FA78}',
    overview: 'Hemoglobin testing checks for anemia, a common condition that can affect energy levels, concentration, and growth.',
    method: 'Point-of-Care Testing',
    healthyMessage: 'Your child\'s hemoglobin levels are within the normal range, indicating no signs of anemia.',
    conditions: [
      {
        id: 'iron_deficiency_anemia',
        name: 'Iron Deficiency Anemia',
        symptoms: 'Fatigue, weakness, pale skin, delayed development, poor concentration.',
        prevalence: 'Affects approximately 30-50% of children under five in India.',
        prevention: 'Ensure a diet rich in iron (leafy greens, meat, beans) and regular health checkups.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include iron supplementation and dietary modifications.',
        whenToSeekHelp: 'If the child exhibits severe fatigue, developmental delays, or symptoms of heart problems.',
      },
      {
        id: 'sickle_cell',
        name: 'Sickle Cell Anemia',
        symptoms: 'Episodes of pain, fatigue, swelling in hands and feet, and delayed growth.',
        prevalence: 'Affects around 1% of children in specific regions of India.',
        prevention: 'Genetic counseling for families with a history of sickle cell disease.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include pain management and possible blood transfusions.',
        whenToSeekHelp: 'If the child experiences severe pain, swelling, or signs of infection.',
      },
    ],
  },

  neurodevelopment: {
    label: 'Neurodevelopment',
    icon: '\u{1F9E0}',
    overview: 'Neurodevelopmental screening evaluates your child\'s cognitive, social, and behavioral development.',
    method: 'AI-Assisted Behavioral Observation',
    healthyMessage: 'Your child\'s neurodevelopmental screening shows age-appropriate development across all domains assessed.',
    conditions: [
      {
        id: 'adhd',
        name: 'ADHD (Attention Deficit Hyperactivity Disorder)',
        symptoms: 'Inattention, hyperactivity, impulsiveness, and difficulty following instructions.',
        prevalence: 'Affects approximately 3-5% of children in India.',
        prevention: 'Early identification and intervention can help manage symptoms.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include behavioral therapy and medications.',
        whenToSeekHelp: 'If the child has trouble concentrating, managing impulses, or maintaining relationships.',
      },
      {
        id: 'asd',
        name: 'Autism Spectrum Disorder (ASD)',
        symptoms: 'Challenges with social skills, repetitive behaviors, and communication difficulties.',
        prevalence: 'Estimated to affect around 1% of children in India.',
        prevention: 'Early screening and intervention can improve outcomes.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include behavioral therapy, speech therapy, and educational support.',
        whenToSeekHelp: 'If the child shows delays in speech, social interaction, or unusual behaviors.',
      },
      {
        id: 'anxiety',
        name: 'Anxiety Disorders',
        symptoms: 'Excessive worry, restlessness, difficulty concentrating, headaches, stomachaches.',
        prevalence: 'Affects about 10-20% of children.',
        prevention: 'Encourage open communication, provide a supportive environment, and teach coping strategies.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Further steps may include therapy, medication, and parental support.',
        whenToSeekHelp: 'If the child has persistent anxiety that interferes with daily activities or development.',
      },
    ],
  },

  immunization: {
    label: 'Immunization',
    icon: '\u{1F489}',
    overview: 'Immunization review checks whether your child has received all age-appropriate vaccinations.',
    method: 'Record Review',
    healthyMessage: 'Your child\'s immunization records show all age-appropriate vaccinations are up to date.',
    conditions: [
      {
        id: 'incomplete_immunization',
        name: 'Incomplete Immunization',
        symptoms: 'No symptoms — but leaves the child vulnerable to preventable diseases.',
        prevalence: 'Partial immunization is common, especially in rural areas.',
        prevention: 'Follow the national immunization schedule from birth.',
        care: 'Consult your SKIDS pediatrician for further evaluation. A catch-up schedule can bring your child up to date safely.',
        whenToSeekHelp: 'Visit your nearest health center to complete the missing vaccinations.',
      },
    ],
  },

  vitals: {
    label: 'Vitals',
    icon: '\u{1F4C8}',
    overview: 'Vital signs measurement checks your child\'s heart rate and basic cardiovascular function.',
    method: 'AI-Assisted Video Analysis (rPPG)',
    healthyMessage: 'Your child\'s vital signs, including heart rate, are within normal limits.',
    conditions: [],
  },

  spo2: {
    label: 'SpO2',
    icon: '\u{1F4A7}',
    overview: 'Oxygen saturation (SpO2) measures how well oxygen is being carried in your child\'s blood.',
    method: 'Pulse Oximetry',
    healthyMessage: 'Your child\'s blood oxygen level is normal (95-100%).',
    conditions: [
      {
        id: 'hypoxemia',
        name: 'Low Oxygen Saturation',
        symptoms: 'Bluish tinge to lips/fingers, shortness of breath, rapid breathing.',
        prevalence: 'Varies; more common in children with respiratory or cardiac conditions.',
        prevention: 'Prompt treatment of respiratory infections, management of underlying conditions.',
        care: 'Consult your SKIDS pediatrician immediately. Low SpO2 requires urgent evaluation.',
        whenToSeekHelp: 'If SpO2 consistently reads below 95%, or the child appears short of breath.',
      },
    ],
  },

  muac: {
    label: 'MUAC',
    icon: '\u{1F4CF}',
    overview: 'Mid-Upper Arm Circumference (MUAC) is a quick way to screen for acute malnutrition in children.',
    method: 'MUAC Tape Measurement',
    healthyMessage: 'Your child\'s MUAC measurement is within the normal range.',
    conditions: [
      {
        id: 'sam_muac',
        name: 'Severe Acute Malnutrition (SAM)',
        symptoms: 'Visible wasting, very thin arms and legs, MUAC below 115 mm.',
        prevalence: 'Affects approximately 7.5% of children under 5 in India.',
        prevention: 'Ensure adequate nutrition, especially protein-rich foods. Regular growth monitoring.',
        care: 'Consult your SKIDS pediatrician immediately. Therapeutic feeding under medical supervision is required.',
        whenToSeekHelp: 'Immediately — SAM is a medical emergency. Visit the nearest health center.',
      },
      {
        id: 'mam_muac',
        name: 'Moderate Acute Malnutrition (MAM)',
        symptoms: 'Mild wasting, MUAC between 115-125 mm, low energy.',
        prevalence: 'Affects approximately 15% of children under 5 in India.',
        prevention: 'A balanced diet with sufficient protein, fats, and micronutrients.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Supplementary feeding and nutritional counseling are recommended.',
        whenToSeekHelp: 'If the child is losing weight, has poor appetite, or shows signs of illness.',
      },
    ],
  },

  nutrition_intake: {
    label: 'Nutrition Intake',
    icon: '\u{1F34E}',
    overview: 'Nutrition intake assessment evaluates your child\'s dietary habits.',
    method: 'Dietary Recall & Questionnaire',
    healthyMessage: 'Your child\'s nutritional intake appears adequate with good dietary diversity.',
    conditions: [
      {
        id: 'poor_dietary_diversity',
        name: 'Poor Dietary Diversity',
        symptoms: 'Limited food variety, missing food groups, low fruit/vegetable intake.',
        prevalence: 'Affects a significant proportion of children, especially in lower-income households.',
        prevention: 'Ensure meals include grains, proteins, dairy, fruits, and vegetables daily.',
        care: 'Consult your SKIDS pediatrician for nutritional counseling.',
        whenToSeekHelp: 'If the child shows signs of nutritional deficiency (fatigue, poor growth, frequent illness).',
      },
      {
        id: 'junk_food_excess',
        name: 'Excessive Junk Food / Sugary Drinks',
        symptoms: 'Frequent consumption of processed foods, sugary beverages, chips, and sweets.',
        prevalence: 'Increasing in urban India — affects over 40% of school-age children.',
        prevention: 'Limit access to junk food, pack healthy school lunches, model good eating habits.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Gradual dietary changes and education about healthy choices are recommended.',
        whenToSeekHelp: 'If the child is overweight, has dental caries, or shows signs of metabolic issues.',
      },
    ],
  },

  intervention: {
    label: 'Interventions',
    icon: '\u{1F48A}',
    overview: 'This section tracks any health interventions administered or recommended during the screening.',
    method: 'Record Review & Administration',
    healthyMessage: 'No immediate interventions were required during this screening.',
    conditions: [
      {
        id: 'deworming_needed',
        name: 'Deworming Required',
        symptoms: 'Abdominal pain, poor appetite, anemia, poor growth.',
        prevalence: 'Intestinal worm infections affect over 200 million children in India.',
        prevention: 'Regular deworming (every 6 months), hand hygiene, wearing shoes, safe water and sanitation.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Albendazole or Mebendazole is typically administered.',
        whenToSeekHelp: 'If the child has recurrent abdominal complaints, visible worms in stool, or signs of anemia.',
      },
      {
        id: 'supplementation_needed',
        name: 'Vitamin/Mineral Supplementation Needed',
        symptoms: 'Signs of deficiency — fatigue, poor growth, frequent infections, pale skin.',
        prevalence: 'Micronutrient deficiencies are widespread among Indian children.',
        prevention: 'A diverse diet rich in fruits, vegetables, and proteins.',
        care: 'Consult your SKIDS pediatrician for further evaluation. Iron, Vitamin A, or other supplements may be prescribed.',
        whenToSeekHelp: 'If the child shows persistent signs of deficiency despite dietary improvements.',
      },
    ],
  },
}

/** Look up report content for a module type */
export function getReportContent(moduleType: string): ModuleReportContent | undefined {
  return REPORT_CONTENT[moduleType]
}

/** Find a specific condition across all modules */
export function findReportCondition(conditionId: string): (ReportCondition & { moduleType: string }) | undefined {
  for (const [moduleType, content] of Object.entries(REPORT_CONTENT)) {
    const cond = content.conditions.find(c => c.id === conditionId)
    if (cond) return { ...cond, moduleType }
  }
  return undefined
}
