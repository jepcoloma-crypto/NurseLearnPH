-- ============================================================
-- NurseLearn PH — Standard NANDA-I Nursing Diagnoses
-- Based on NANDA-I Taxonomy II (2024-2026)
-- For Philippine BSN Nursing Education
-- ============================================================
-- Run: psql -d nurselearn_ph -U postgres -f server/scripts/seed-nanda-diagnoses.sql
-- ============================================================

DELETE FROM nursing_diagnoses;

-- ── Domain 1: Health Promotion ──────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00001', 'Readiness for Enhanced Health Management', 'Health Promotion',
 'A pattern of regulating and integrating into daily living that is sufficient for meeting health-related demands, but can be strengthened',
 NULL,
 '["Expresses desire to manage health","Demonstrates awareness of health risks"]'::jsonb),

('00013', 'Fatigue', 'Health Promotion',
 'A self-reported state of tiredness and decreased capacity for physical and mental work',
 '["Decreased physical fitness","Sleep disturbance","Stress","Pain","Medications"]'::jsonb,
 '["Chronic illness","Surgical recovery","Emotional stress","Malnutrition"]'::jsonb),

('00162', 'Sedentary Lifestyle', 'Health Promotion',
 'A modifiable state of reduced physical activity level',
 '["Lack of interest in exercise","Physical limitation","Obesity"]'::jsonb,
 '["Lack of knowledge","Environmental barriers","Fatigue"]'::jsonb);

-- ── Domain 2: Nutrition ─────────────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00002', 'Imbalanced Nutrition: Less Than Body Requirements', 'Nutrition',
 'Intake of nutrients insufficient to meet metabolic needs as evidenced by weight loss and nutrient laboratory values below normal limits',
 '["Inability to ingest food","Inability to digest food","Inability to absorb nutrients","Cachexia"]'::jsonb,
 '["Anorexia","Nausea/vomiting","Depression","Lack of knowledge","Dysphagia"]'::jsonb),

('00003', 'Imbalanced Nutrition: More Than Body Requirements', 'Nutrition',
 'Intake of nutrients exceeding metabolic needs as evidenced by overweight or obesity',
 '["Sedentary lifestyle","Excessive intake","Metabolic imbalance"]'::jsonb,
 '["Stress","Sedentary activity level","Knowledge deficit","Cultural factors"]'::jsonb),

('00220', 'Risk for Unstable Blood Glucose Level', 'Nutrition',
 'Vulnerable to experiencing fluctuation of blood glucose levels beyond the normal range',
 '["Diabetes mellitus","Pancreatic disease","Obesity","Sedentary lifestyle"]'::jsonb,
 '["Inadequate diabetes management","Medication noncompliance","Stress"]'::jsonb);

-- ── Domain 3: Elimination ───────────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00011', 'Constipation', 'Elimination',
 'A decrease in frequency of defecation with hard, dry stools and/or difficulty in passing stool',
 '["Low fiber diet","Sedentary lifestyle","Dehydration","Medications"]'::jsonb,
 '["Lack of physical activity","Irregular defecation habits","Depression"]'::jsonb),

('00017', 'Urinary Retention', 'Elimination',
 'Incomplete emptying of the bladder',
 '["Enlarged prostate","Urethral stricture","Neurological impairment"]'::jsonb,
 '["Anesthesia","Medications","Pain","Weakened bladder muscle"]'::jsonb),

('00014', 'Functional Urinary Incontinence', 'Elimination',
 'Inability to control urination due to physical impairment',
 '["Mobility impairment","Cognitive impairment","Medications"]'::jsonb,
 '["Muscle weakness","Altered physical environment"]'::jsonb);

-- ── Domain 4: Activity/Rest ─────────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00032', 'Ineffective Breathing Pattern', 'Activity/Rest',
 'Inhalation and exhalation that does not provide adequate ventilation as evidenced by dyspnea, abnormal respiratory rate, depth, or rhythm, and use of accessory muscles',
 '["Chest pain","Fatigue","Neuromuscular impairment","Anxiety"]'::jsonb,
 '["Tracheobronchial obstruction","Pain","Musculoskeletal impairment"]'::jsonb),

('00031', 'Ineffective Airway Clearance', 'Activity/Rest',
 'Inability to clear secretions or obstructions from the airway to maintain airway patency',
 '["Tracheobronchial obstruction","Secretions in airway","Neuromuscular impairment"]'::jsonb,
 '["Increased mucus production","Pain","Fatigue","Decreased energy"]'::jsonb),

('00004', 'Impaired Gas Exchange', 'Activity/Rest',
 'Excess or deficit at the level of alveolar-capillary membrane associated with altered oxygen supply, carbon dioxide elimination, or both',
 '["Altered oxygen supply","Alveolar-capillary membrane changes","Altered blood flow"]'::jsonb,
 '["Chest trauma","Cardiac disease","Pulmonary disease","Neuromuscular dysfunction"]'::jsonb),

('00092', 'Activity Intolerance', 'Activity/Rest',
 'Insufficient physiological or psychological energy to complete or continue required or desired daily activities',
 '["Generalized weakness","Deconditioning","Sedentary lifestyle"]'::jsonb,
 '["Cardiac disease","Pulmonary disease","Anemia","Pain"]'::jsonb),

('00085', 'Impaired Physical Mobility', 'Activity/Rest',
 'Limitation of independent physical movement of the body or one or more extremities',
 '["Neuromuscular impairment","Musculoskeletal impairment","Pain"]'::jsonb,
 '["Cerebrovascular accident","Fracture","Paralysis","Joint stiffness"]'::jsonb),

('00155', 'Risk for Falls', 'Activity/Rest',
 'Vulnerable to increased susceptibility to falls that may cause physical injury',
 '["Muscle weakness","Impaired mobility","Sensory deficit","Medications"]'::jsonb,
 '["Environmental hazards","Age-related changes","Cognitive impairment"]'::jsonb),

('00006', 'Hypothermia', 'Activity/Rest',
 'Core body temperature below the required range for normal metabolism and body functioning',
 '["Exposure to cold","Inadequate clothing","Shivering impairment"]'::jsonb,
 '["Burns","Sepsis","Hypothyroidism","Neurological impairment"]'::jsonb),

('00007', 'Hyperthermia', 'Activity/Rest',
 'Core body temperature above the required range as evidenced by an increase in body temperature',
 '["Infection","Inflammation","Dehydration","Environmental heat exposure"]'::jsonb,
 '["Medications","Increased metabolic rate","Inability to perspire"]'::jsonb);

-- ── Domain 5: Perception/Cognition ──────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00145', 'Acute Confusion', 'Perception/Cognition',
 'An abrupt onset of a cluster of global, transient changes and disturbances in attention, cognition, psychomotor behavior, level of consciousness, and/or the sleep-wake cycle',
 '["Advanced age","Substance use","Cognitive impairment"]'::jsonb,
 '["Infection","Electrolyte imbalance","Medications","Sleep deprivation"]'::jsonb),

('00069', 'Impaired Memory', 'Perception/Cognition',
 'Inability to remember or recall bits of information or behavior patterns as evidenced by forgetfulness and difficulty following instructions',
 '["Cognitive decline","Advanced age","Neurological disorder"]'::jsonb,
 '["Medications","Stress","Depression","Sleep disturbance"]'::jsonb);

-- ── Domain 6: Self-Perception ───────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00153', 'Situational Low Self-Esteem', 'Self-Perception',
 'Negative self-evaluation or feelings about self or capabilities prompted by a specific situation',
 '["Loss of job","Loss of role function","Perceived failure"]'::jsonb,
 '["Chronic illness","Pain","Loss of independence","Social isolation"]'::jsonb),

('00172', 'Complicated Grieving', 'Self-Perception',
 'A disorder that occurs after the death of a significant person or after a loss of a tangible body part or function, characterized by states of distortion such as numbness, guilt, hostility, or preoccupation with the deceased',
 '["Sudden death of loved one","Loss of body function","Chronic illness"]'::jsonb,
 '["Lack of social support","History of depression","Unresolved grief"]'::jsonb);

-- ── Domain 7: Role Relationship ─────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00052', 'Impaired Social Interaction', 'Role Relationship',
 'Insufficient or excessive quantity or ineffective quality of social exchange',
 '["Social isolation","Altered mental status","Communication barrier"]'::jsonb,
 '["Low self-esteem","Lack of role model","Psychiatric disturbances"]'::jsonb);

-- ── Domain 8: Sexuality ─────────────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00058', 'Sexual Dysfunction', 'Sexuality',
 'Change in sexual functioning or satisfaction as evidenced by verbal or nonverbal response indicating alteration in sexual activity or satisfaction',
 '["Chronic illness","Pain","Body image disturbance","Medications"]'::jsonb,
 '["Neurological deficit","Hormonal imbalance","Relationship issues"]'::jsonb);

-- ── Domain 9: Coping/Stress Tolerance ───────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00146', 'Anxiety', 'Coping/Stress Tolerance',
 'Presence of ominous clouding or vague feelings, feelings of uneasiness or apprehension that may be accompanied by autonomic responses as evidenced by restlessness, insomnia, and digestive disturbance',
 '["Threat to self-concept","Threat to biophysical integrity","Threat to social integrity"]'::jsonb,
 '["Unmet expectations","Loss of control","Environmental changes","Neurological factors"]'::jsonb),

('00148', 'Fear', 'Coping/Stress Tolerance',
 'Response to perceived threat that is consciously recognized as a danger',
 '["Fear of death","Fear of pain","Fear of disability"]'::jsonb,
 '["Genetic factors","Threat to well-being","Past traumatic experience"]'::jsonb),

('00074', 'Ineffective Coping', 'Coping/Stress Tolerance',
 'Inability to form a valid appraisal of the stressor, inability to use available resources, and/or inability to choose acceptable alternatives for problem solving',
 '["Situational crisis","Inadequate support system","Impaired cognition"]'::jsonb,
 '["Chronic illness","Pain","Substance abuse","Lack of knowledge"]'::jsonb),

('00075', 'Ineffective Family Coping', 'Coping/Stress Tolerance',
 'Disablement of or compromised capacity of the primary person and/or family members to provide for the family member''s needs as evidenced by denial, disorientation, lack of guidance, and/or anxiety',
 '["Chronic illness in family member","Family role changes","Inadequate family support"]'::jsonb,
 '["Family conflict","Financial problems","Lack of knowledge"]'::jsonb);

-- ── Domain 10: Safety/Protection ────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00009', 'Risk for Infection', 'Safety/Protection',
 'Vulnerable to invasion by pathogenic organisms as evidenced by body temperature above the normal range and changes in white blood cell count',
 '["Inadequate primary defenses","Inadequate secondary defenses","Immunosuppression"]'::jsonb,
 '["Tissue damage","Invasive procedures","Malnutrition","Chronic illness"]'::jsonb),

('00035', 'Risk for Trauma', 'Safety/Protection',
 'Vulnerable to physical injury due to environmental conditions interacting with the individual''s adaptive and defensive resources',
 '["Altered mental state","Sensory deficit","Extremity weakness"]'::jsonb,
 '["Environmental hazards","Age-related changes","Fatigue"]'::jsonb),

('00037', 'Risk for Suffocation', 'Safety/Protection',
 'At risk for suffocation due to an obstruction of air flow into the lungs resulting in inadequate oxygen exchange',
 '["Obstruction of airway","Extremes of age","Reduced consciousness"]'::jsonb,
 '["Aspiration of foreign body","Edema","Secretion retention"]'::jsonb),

('00039', 'Risk for Poisoning', 'Safety/Protection',
 'Vulnerable to accidental exposure to a chemical substance in a dosage sufficient to cause structural or functional damage',
 '["Cognitive impairment","Altered mobility","Inadequate supervision"]'::jsonb,
 '["Substance misuse","Medication error","Environmental toxins"]'::jsonb),

('00046', 'Impaired Skin Integrity', 'Safety/Protection',
 'Compromise of epidermis and/or dermis as evidenced by blister, denuded, or abrasion areas',
 '["Altered nutritional state","Impaired circulation","Immobility"]'::jsonb,
 '["Moisture","Pressure","Physical agents","Medications"]'::jsonb),

('00045', 'Risk for Shock', 'Safety/Protection',
 'Vulnerable to a potentially life-threatening state of inadequate cellular perfusion that may affect every body system',
 '["Hypovolemia","Sepsis","Anaphylaxis","Cardiac disease"]'::jsonb,
 '["Trauma","Burns","Medications","Dehydration"]'::jsonb);

-- ── Domain 11: Comfort ──────────────────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00132', 'Acute Pain', 'Comfort',
 'Unpleasant sensory and emotional experience arising from actual or potential tissue damage or described in terms of such damage, with sudden or slow onset of any intensity lasting less than 6 months',
 '["Surgical intervention","Trauma","Inflammation"]'::jsonb,
 '["Tissue damage","Physical agents","Chemical agents"]'::jsonb),

('00133', 'Chronic Pain', 'Comfort',
 'Unpleasant sensory and emotional experience arising from actual or potential tissue damage or described in terms of such damage, ranging from mild to unbearable with duration greater than 6 months',
 '["Chronic illness","Repeated injury","Nerve damage"]'::jsonb,
 '["Long-term tissue damage","Degenerative disease","Inadequate pain management"]'::jsonb),

('00195', 'Nausea', 'Comfort',
 'A subjective, unpleasant, wavelike sensation in the back of the throat and epigastrium that may or may not culminate in vomiting',
 '["Treatment regimen","Gastrointestinal distress","Metabolic disturbance"]'::jsonb,
 '["Medications","Infection","Pregnancy","Pain"]'::jsonb);

-- ── Domain 12: Growth/Development ───────────────────────────

INSERT INTO nursing_diagnoses (code, name, category, definition, risk_factors, related_factors) VALUES
('00110', 'Risk for Delayed Development', 'Growth/Development',
 'Vulnerable to a delay in reaching age-appropriate developmental milestones as a result of inherent and/or extrinsic risk factors',
 '["Prematurity","Low birth weight","Chronic illness"]'::jsonb,
 '["Inadequate stimulation","Neglect","Genetic factors","Poverty"]'::jsonb);

-- ── Summary ─────────────────────────────────────────────────
SELECT
  category,
  count(*) AS diagnoses,
  min(code) AS first_code,
  max(code) AS last_code
FROM nursing_diagnoses
GROUP BY category
ORDER BY category;

SELECT count(*) AS total_diagnoses FROM nursing_diagnoses;
