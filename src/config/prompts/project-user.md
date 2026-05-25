Analyze this project and respond with ONLY a JSON object (no markdown fences, no commentary):

{
  "summary": "1-2 sentence description + current state",
  "nextAction": "single most important next step",
  "status": "building|shipping|maintaining|blocked|completed|idea",
  "statusReason": "why this status",
  "tags": ["3-8 descriptive tags"],
  "insights": [{"text": "observation + action", "severity": "green|amber|red"}],
  "framework": "primary framework or null",
  "primaryLanguage": "dominant language or null"
}

Project data:

Name: {{name}}
Path: {{path}}
Status: {{statusAuto}}
Health Score: {{healthScore}}/100
Hygiene Score: {{hygieneScore}}/100
Momentum Score: {{momentumScore}}/100
Derived Tags: {{tags}}

Raw scan data:
{{scanData}}

{{githubBlock}}

{{previousSummaryBlock}}