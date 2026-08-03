# Psychometric Assessment System — Career Portal

A fully custom-built psychometric assessment system integrated into a Career Portal.
All data is stored in the browser's `localStorage`. No server or database setup required.

---

## How to Open

Simply open **`index.html`** in a web browser (Chrome, Edge, Firefox).

> **Important:** Some browsers restrict `file://` access to `localStorage`.  
> If the app doesn't work, run a simple local server:
>
> ```bash
> # Python 3
> python -m http.server 8080
> # Then open: http://localhost:8080
> ```

---

## Login Credentials

### HR Admin
| Field    | Value                  |
|----------|------------------------|
| Email    | admin@company.com      |
| Password | Admin@123              |

### Demo Candidates (password for all: `Pass@123`)
| Name              | Email                         | Status               |
|-------------------|-------------------------------|----------------------|
| Sarah Ahmed       | sarah.ahmed@email.com         | Applied              |
| James Carter      | james.carter@email.com        | Assessment Assigned  |
| Priya Sharma      | priya.sharma@email.com        | Completed — PASSED   |
| Marcus Johnson    | marcus.johnson@email.com      | Completed — FAILED   |
| Elena Rodriguez   | elena.rodriguez@email.com     | Interview            |

---

## Features

### HR Admin Panel (`admin.html`)
- **Dashboard** — 12 live stat cards, recruitment funnel, searchable/sortable candidate table
- **Assessments** — Create, edit, activate/deactivate, delete assessments
- **Assessment Builder** — Multiple Choice (per-option scoring) + Likert Scale questions
- **Candidate Profile** — View resume, assign assessments, update recruitment status, view responses

### Candidate Portal (`candidate.html`)
- **My Assessments** — View pending and completed assessments with results
- **Take Assessment** — Timer, one question at a time, prev/next navigation, auto-submit on timeout
- **My Profile** — Personal info, resume upload (PDF/DOC, up to 2MB), assessment history

---

## Google Sign-In Setup (Optional)

Google Sign-In is disabled by default. To enable it:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Set **Authorized JavaScript origins** to `http://localhost:8080` (or your domain)
4. Copy the **Client ID**
5. Open `js/config.js` and set:

```js
GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com'
```

> Google Sign-In does **not** work over `file://` — you must use a local server.

---

## Scoring Logic

```
Max Score = sum of all question scoreValues
Raw Score = sum of scoreAwarded per response
Percentage = round(Raw / Max × 100)
Pass/Fail  = Percentage >= assessment.passingScore ? "Pass" : "Fail"
```

### Multiple Choice
Each option has a `scoreValue`. Correct options get the full score; wrong options get 0.

### Likert Scale
Fixed 5-point scale: Strongly Agree (5) → Strongly Disagree (1).  
Question's `scoreValue` = 5 (configurable when creating the assessment).

---

## File Structure

```
assesment test/
├── index.html              ← Login page
├── admin.html              ← HR Admin SPA
├── candidate.html          ← Candidate SPA
├── css/
│   └── styles.css          ← Global styles
└── js/
    ├── config.js            ← App config (Google Client ID)
    ├── db.js                ← localStorage DB layer
    ├── auth.js              ← Authentication
    ├── utils.js             ← Shared utilities
    ├── seed.js              ← Demo data
    ├── admin/
    │   ├── app.js           ← Admin router
    │   ├── dashboard.js     ← Dashboard page
    │   ├── assessments.js   ← Assessment list
    │   ├── assessment-form.js ← Create/Edit form
    │   └── candidate-profile.js ← Profile page
    └── candidate/
        ├── app.js           ← Candidate router
        ├── portal.js        ← Portal home
        ├── take-assessment.js ← Assessment flow
        └── profile.js       ← Profile + resume
```

---

## Resetting Demo Data

Open the browser console on any page and run:

```js
DB.resetAll();
location.reload();
```

This clears all data and re-seeds on next load.

---

## Future Scalability

The modular architecture supports future additions:
- Personality trait analysis (add new `questionType`)
- Aptitude / behavioral tests (new assessment categories)
- AI ranking (add scoring weights to questions)
- Charts (plug into dashboard stats data)
- Email notifications (connect to an email API)
- Backend migration (swap `DB` layer with REST API calls)
