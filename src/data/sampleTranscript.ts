export const SAMPLE_MEETING = {
  title: 'Sprint 14 Launch Planning & Infrastructure Review',
  date: new Date().toISOString().split('T')[0],
  participants: ['Alex Rivera', 'Maya Chen', 'Jordan Patel', 'Sam Lee'],
  transcript: `Alex Rivera: Welcome everyone. Let's align on Sprint 14 priorities and launch blockers. We have four core workstreams to review today.

Maya Chen: On the infrastructure side, I will finish the database migration script by next Monday, November 9th. The schema updates are already tested on staging, so November 9th is a hard commitment from me.

Alex Rivera: Excellent. That gives us enough buffer for load testing before launch. What about the frontend authentication overhaul?

Jordan Patel: I'll handle refactoring the user onboarding flow, but I need to check how long the mobile responsive designs will take with the UX team, so I don't have a firm date yet. Put me down for the onboarding refactoring, but deadline is pending design signoff.

Sam Lee: Got it. Also on the infrastructure side, someone needs to set up the monitoring alerts and Grafana dashboards for the production Kubernetes cluster before we deploy. We can't go live blind.

Alex Rivera: Good catch Sam. We definitely need that in place.

Alex Rivera: Speaking of services, maybe we could rewrite the entire billing service in Go over the weekend? It might improve throughput.

Maya Chen: No, absolutely not. That is way too risky right now with launch scheduled for next week. Let's keep the existing Node service for this launch and revisit rewrites next quarter.

Alex Rivera: Fair point Maya. Agreed, we will keep the existing Node service for billing and not do any language rewrites for Sprint 14.

Jordan Patel: Quick question for the group: what is our budget limit for the third-party email provider upgrade?

Alex Rivera: Let's discuss that in a separate thread. Moving on to documentation...

Sam Lee: Regarding the API documentation, Alex mentioned earlier that it is due this Thursday, but the sprint board says it must be done by tomorrow Friday. We need to clarify which day it is actually due.

Maya Chen: Let's confirm with product tomorrow morning. Everyone please make sure your local test environments are synced today.`,
};
