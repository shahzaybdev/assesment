/**
 * Seed — Demo Data
 * Runs once on first load. Creates 5 candidates, 1 assessment, 8 questions,
 * and pre-filled results for 3 candidates.
 *
 * Candidate login credentials (all use password: Pass@123):
 *   sarah.ahmed@email.com
 *   james.carter@email.com
 *   priya.sharma@email.com
 *   marcus.johnson@email.com
 *   elena.rodriguez@email.com
 */
function seedDatabase() {
  if (DB.isSeeded()) return;

  // ── Password hash (mirrors Auth._hash) ──────────────────────────────────
  function _hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(36);
  }
  const pw = _hash('Pass@123');

  // ── CANDIDATES ───────────────────────────────────────────────────────────
  const sarah = DB.insert(DB.TABLES.CANDIDATES, {
    name: 'Sarah Ahmed',
    email: 'sarah.ahmed@email.com',
    picture: '', resumeUrl: '', resumeName: '',
    recruitmentStatus: 'Applied',
    appliedAt: '2026-07-10T09:00:00.000Z'
  });

  const james = DB.insert(DB.TABLES.CANDIDATES, {
    name: 'James Carter',
    email: 'james.carter@email.com',
    picture: '', resumeUrl: '', resumeName: '',
    recruitmentStatus: 'Assessment Assigned',
    appliedAt: '2026-07-12T10:30:00.000Z'
  });

  const priya = DB.insert(DB.TABLES.CANDIDATES, {
    name: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    picture: '', resumeUrl: '', resumeName: '',
    recruitmentStatus: 'Assessment Completed',
    appliedAt: '2026-07-08T08:15:00.000Z'
  });

  const marcus = DB.insert(DB.TABLES.CANDIDATES, {
    name: 'Marcus Johnson',
    email: 'marcus.johnson@email.com',
    picture: '', resumeUrl: '', resumeName: '',
    recruitmentStatus: 'Assessment Completed',
    appliedAt: '2026-07-09T14:00:00.000Z'
  });

  const elena = DB.insert(DB.TABLES.CANDIDATES, {
    name: 'Elena Rodriguez',
    email: 'elena.rodriguez@email.com',
    picture: '', resumeUrl: '', resumeName: '',
    recruitmentStatus: 'Interview',
    appliedAt: '2026-07-05T11:00:00.000Z'
  });

  // ── USERS ────────────────────────────────────────────────────────────────
  [sarah, james, priya, marcus, elena].forEach(c => {
    DB.insert(DB.TABLES.USERS, {
      email: c.email, name: c.name, role: 'candidate',
      passwordHash: pw, googleId: '', candidateId: c.id,
      createdAt: new Date().toISOString()
    });
  });

  // ── ASSESSMENT ───────────────────────────────────────────────────────────
  const assessment = DB.insert(DB.TABLES.ASSESSMENTS, {
    title: 'General Cognitive Aptitude Test',
    description: 'This assessment evaluates logical reasoning, numerical ability, and workplace attitude. Read each question carefully before selecting your answer. You have 30 minutes to complete all questions.',
    duration: 30,
    passingScore: 60,
    status: 'Active',
    createdAt: '2026-07-01T08:00:00.000Z'
  });

  // ── QUESTIONS ─────────────────────────────────────────────────────────────
  // Max total score = 10+10+15+10+10+5+5+5 = 70

  const q1 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 1,
    questionText: 'What is 15% of 200?',
    questionType: 'multiple_choice',
    options: [
      { text: '30',  scoreValue: 10 },  // correct
      { text: '25',  scoreValue: 0  },
      { text: '35',  scoreValue: 0  },
      { text: '40',  scoreValue: 0  }
    ],
    scoreValue: 10
  });

  const q2 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 2,
    questionText: 'Which shape has the most sides among the following options?',
    questionType: 'multiple_choice',
    options: [
      { text: 'Triangle', scoreValue: 0  },
      { text: 'Pentagon',  scoreValue: 0  },
      { text: 'Hexagon',   scoreValue: 10 }, // correct
      { text: 'Square',    scoreValue: 0  }
    ],
    scoreValue: 10
  });

  const q3 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 3,
    questionText: 'If 5 people can complete a project in 10 days, how many days would 10 people take (assuming equal productivity)?',
    questionType: 'multiple_choice',
    options: [
      { text: '5 days',  scoreValue: 15 }, // correct
      { text: '10 days', scoreValue: 0  },
      { text: '20 days', scoreValue: 0  },
      { text: '2 days',  scoreValue: 0  }
    ],
    scoreValue: 15
  });

  const q4 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 4,
    questionText: 'What comes next in the sequence: 3, 6, 12, 24, ___?',
    questionType: 'multiple_choice',
    options: [
      { text: '36', scoreValue: 0  },
      { text: '42', scoreValue: 0  },
      { text: '48', scoreValue: 10 }, // correct
      { text: '28', scoreValue: 0  }
    ],
    scoreValue: 10
  });

  const q5 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 5,
    questionText: 'Which word is a synonym of "diligent"?',
    questionType: 'multiple_choice',
    options: [
      { text: 'Lazy',        scoreValue: 0  },
      { text: 'Hardworking', scoreValue: 10 }, // correct
      { text: 'Careless',    scoreValue: 0  },
      { text: 'Passive',     scoreValue: 0  }
    ],
    scoreValue: 10
  });

  const q6 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 6,
    questionText: 'I prefer working in a structured and organized environment.',
    questionType: 'likert',
    options: [
      { text: 'Strongly Agree',    scoreValue: 5 },
      { text: 'Agree',             scoreValue: 4 },
      { text: 'Neutral',           scoreValue: 3 },
      { text: 'Disagree',          scoreValue: 2 },
      { text: 'Strongly Disagree', scoreValue: 1 }
    ],
    scoreValue: 5
  });

  const q7 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 7,
    questionText: 'I can effectively manage multiple tasks simultaneously without compromising quality.',
    questionType: 'likert',
    options: [
      { text: 'Strongly Agree',    scoreValue: 5 },
      { text: 'Agree',             scoreValue: 4 },
      { text: 'Neutral',           scoreValue: 3 },
      { text: 'Disagree',          scoreValue: 2 },
      { text: 'Strongly Disagree', scoreValue: 1 }
    ],
    scoreValue: 5
  });

  const q8 = DB.insert(DB.TABLES.QUESTIONS, {
    assessmentId: assessment.id, order: 8,
    questionText: 'I remain calm and composed when working under pressure or tight deadlines.',
    questionType: 'likert',
    options: [
      { text: 'Strongly Agree',    scoreValue: 5 },
      { text: 'Agree',             scoreValue: 4 },
      { text: 'Neutral',           scoreValue: 3 },
      { text: 'Disagree',          scoreValue: 2 },
      { text: 'Strongly Disagree', scoreValue: 1 }
    ],
    scoreValue: 5
  });

  // ── JAMES — Assigned, Not Started ────────────────────────────────────────
  DB.insert(DB.TABLES.CANDIDATE_ASSESSMENTS, {
    candidateId: james.id, assessmentId: assessment.id,
    totalScore: null, passFail: null,
    completed: false, completionTime: null, completedAt: null, startedAt: null,
    assignedAt: '2026-07-15T09:00:00.000Z'
  });

  // ── PRIYA — Completed, PASSED (80%) ──────────────────────────────────────
  // Responses: Q1 wrong(0), Q2 correct(10), Q3 correct(15), Q4 correct(10), Q5 correct(10),
  //            Q6 Agree(4), Q7 Agree(4), Q8 Neutral(3) → raw=56/70 → 80%
  const priyaCA = DB.insert(DB.TABLES.CANDIDATE_ASSESSMENTS, {
    candidateId: priya.id, assessmentId: assessment.id,
    totalScore: 80, passFail: 'Pass',
    completed: true, completionTime: 1547,
    completedAt: '2026-07-18T10:32:00.000Z',
    startedAt:  '2026-07-18T10:06:13.000Z',
    assignedAt: '2026-07-16T09:00:00.000Z'
  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q1.id, selectedAnswer: '25',          scoreAwarded: 0  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q2.id, selectedAnswer: 'Hexagon',     scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q3.id, selectedAnswer: '5 days',      scoreAwarded: 15 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q4.id, selectedAnswer: '48',          scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q5.id, selectedAnswer: 'Hardworking', scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q6.id, selectedAnswer: 'Agree',       scoreAwarded: 4  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q7.id, selectedAnswer: 'Agree',       scoreAwarded: 4  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: priyaCA.id, questionId: q8.id, selectedAnswer: 'Neutral',     scoreAwarded: 3  });

  // ── MARCUS — Completed, FAILED (43%) ─────────────────────────────────────
  // Responses: Q1 wrong(0), Q2 wrong(0), Q3 correct(15), Q4 wrong(0), Q5 correct(10),
  //            Q6 Disagree(2), Q7 Disagree(2), Q8 Strongly Disagree(1) → raw=30/70 → 43%
  const marcusCA = DB.insert(DB.TABLES.CANDIDATE_ASSESSMENTS, {
    candidateId: marcus.id, assessmentId: assessment.id,
    totalScore: 43, passFail: 'Fail',
    completed: true, completionTime: 1820,
    completedAt: '2026-07-19T14:45:00.000Z',
    startedAt:  '2026-07-19T14:14:40.000Z',
    assignedAt: '2026-07-17T09:00:00.000Z'
  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q1.id, selectedAnswer: '40',                scoreAwarded: 0  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q2.id, selectedAnswer: 'Pentagon',          scoreAwarded: 0  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q3.id, selectedAnswer: '5 days',            scoreAwarded: 15 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q4.id, selectedAnswer: '36',                scoreAwarded: 0  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q5.id, selectedAnswer: 'Hardworking',       scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q6.id, selectedAnswer: 'Disagree',          scoreAwarded: 2  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q7.id, selectedAnswer: 'Disagree',          scoreAwarded: 2  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: marcusCA.id, questionId: q8.id, selectedAnswer: 'Strongly Disagree', scoreAwarded: 1  });

  // ── ELENA — Completed, PASSED (99%) — moved to Interview ─────────────────
  // raw=69/70=98.6%→99%
  const elenaCA = DB.insert(DB.TABLES.CANDIDATE_ASSESSMENTS, {
    candidateId: elena.id, assessmentId: assessment.id,
    totalScore: 99, passFail: 'Pass',
    completed: true, completionTime: 1230,
    completedAt: '2026-07-14T09:20:00.000Z',
    startedAt:  '2026-07-14T08:59:30.000Z',
    assignedAt: '2026-07-11T09:00:00.000Z'
  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q1.id, selectedAnswer: '30',               scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q2.id, selectedAnswer: 'Hexagon',          scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q3.id, selectedAnswer: '5 days',           scoreAwarded: 15 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q4.id, selectedAnswer: '48',               scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q5.id, selectedAnswer: 'Hardworking',      scoreAwarded: 10 });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q6.id, selectedAnswer: 'Agree',            scoreAwarded: 4  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q7.id, selectedAnswer: 'Strongly Agree',   scoreAwarded: 5  });
  DB.insert(DB.TABLES.RESPONSES, { candidateAssessmentId: elenaCA.id, questionId: q8.id, selectedAnswer: 'Strongly Agree',   scoreAwarded: 5  });

  DB.markSeeded();
  console.log('[Seed] Database seeded successfully.');
}
