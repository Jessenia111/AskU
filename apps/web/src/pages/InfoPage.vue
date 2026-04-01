<template>
  <div class="max-w-2xl mx-auto px-4 py-8">

    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900">About AskU & Community Rules</h1>
      <p class="mt-2 text-slate-500 text-sm">
        Please read this page before participating. These rules apply to all students equally.
      </p>
    </div>

    <!-- What is AskU -->
    <section class="mb-8">
      <h2 class="section-title">What is AskU?</h2>
      <div class="prose-card">
        <p>
          AskU is an anonymous question-and-answer platform for University of Tartu students.
          It lets you ask questions about your courses without fear of being judged by classmates or lecturers.
        </p>
        <p class="mt-3">
          You log in with your <strong>@ut.ee email</strong> — so the system knows who you are —
          but other students only see your <strong>pseudonym</strong> (a nickname), not your real name or email.
        </p>
      </div>
    </section>

    <!-- How anonymity works -->
    <section class="mb-8">
      <h2 class="section-title">How anonymity works</h2>

      <div class="flex flex-col gap-3">
        <div class="info-card">
          <div>
            <div class="info-label">Anonymous mode (default)</div>
            <p class="info-body">
              You appear as a random pseudonym. This pseudonym is unique to each course and automatically
              <strong>changes every 24 hours</strong> — so even if someone accidentally finds out your
              pseudonym today, it will be different tomorrow.
            </p>
          </div>
        </div>

        <div class="info-card">
          <div>
            <div class="info-label">Real name mode</div>
            <p class="info-body">
              You can choose to show your real name, derived from your @ut.ee email.
              All other students will be able to see your real name on every post and comment you write.
              You can switch modes at any time in your Profile.
            </p>
          </div>
        </div>

        <div class="info-card">
          <div>
            <div class="info-label">What other students see</div>
            <p class="info-body">
              Only your pseudonym (or chosen name), the course, your post content, and the timestamp.
              Your email address, student ID, and all UT identifiers are <strong>never visible</strong> to other students.
            </p>
          </div>
        </div>

        <div class="info-card border-amber-200 bg-amber-50">
          <div>
            <div class="info-label text-amber-800">Important: the system knows who you are</div>
            <p class="info-body text-amber-700">
              AskU uses <em>verified</em> anonymity, not full anonymity. Moderators can look up the real email
              behind any pseudonym in serious cases (threats, illegal content, doxxing). Every such lookup
              is permanently logged. See "De-anonymization" below.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Community rules -->
    <section class="mb-8">
      <h2 class="section-title">Community rules</h2>
      <p class="text-slate-500 text-sm mb-4">The following actions are <strong>not allowed</strong> on AskU:</p>

      <div class="flex flex-col gap-2">
        <div v-for="rule in forbiddenRules" :key="rule.title" class="rule-card">
          <div class="text-red-500 text-lg shrink-0">✕</div>
          <div>
            <div class="font-semibold text-slate-800 text-sm">{{ rule.title }}</div>
            <div class="text-slate-500 text-sm mt-0.5">{{ rule.description }}</div>
          </div>
        </div>
      </div>

      <p class="text-slate-500 text-sm mt-4">Things that are <strong>allowed and encouraged</strong>:</p>
      <div class="flex flex-col gap-2 mt-2">
        <div v-for="rule in allowedRules" :key="rule.title" class="rule-card border-green-200 bg-green-50">
          <div class="text-green-600 text-lg shrink-0">✓</div>
          <div>
            <div class="font-semibold text-slate-800 text-sm">{{ rule.title }}</div>
            <div class="text-slate-500 text-sm mt-0.5">{{ rule.description }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Consequences -->
    <section class="mb-8">
      <h2 class="section-title">Consequences for rule violations</h2>

      <div class="overflow-hidden rounded-xl border border-slate-200">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="text-left px-4 py-3 font-semibold text-slate-700">Severity</th>
              <th class="text-left px-4 py-3 font-semibold text-slate-700">Examples</th>
              <th class="text-left px-4 py-3 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in consequenceTable" :key="row.severity">
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold"
                  :class="row.badgeClass"
                >{{ row.severity }}</span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ row.examples }}</td>
              <td class="px-4 py-3 font-medium" :class="row.actionClass">{{ row.action }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Posting limits -->
    <section class="mb-8">
      <h2 class="section-title">Posting limits</h2>
      <p class="text-slate-500 text-sm mb-1">
        The platform automatically limits how often you can post. These limits exist to
        <strong>prevent spam and flooding</strong> — they are not a punishment and apply equally to everyone.
      </p>
      <p class="text-slate-500 text-sm mb-4">
        New accounts have stricter limits during the first 24 hours because most spam and abuse comes from
        newly created accounts. After 24 hours, the standard limits apply.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div v-for="limit in postingLimits" :key="limit.label" class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{{ limit.label }}</div>
          <div v-for="line in limit.lines" :key="line" class="text-sm text-slate-700 leading-relaxed">{{ line }}</div>
        </div>
      </div>

      <p class="text-slate-400 text-xs mt-3">
        When you reach a limit, you will see an error message. Limits reset automatically after the time period ends.
      </p>
    </section>

    <!-- How reporting works -->
    <section class="mb-8">
      <h2 class="section-title">How reporting works</h2>
      <div class="prose-card">
        <p>
          Every thread and comment has a <strong>Report</strong> button. Use it if you see content that
          breaks the rules. Choose the reason:
        </p>
        <ul class="mt-2 space-y-1 text-sm">
          <li><span class="font-semibold text-yellow-700">Spam</span> — irrelevant, repetitive, or advertising content.</li>
          <li><span class="font-semibold text-red-700">Abuse</span> — harassment, threats, doxxing, or harmful content.</li>
        </ul>
        <p class="mt-3">
          If a post receives <strong>3 or more reports</strong> from different students in the same course,
          it is automatically hidden and sent to the moderation queue. A moderator then reviews it before
          any final action is taken.
        </p>
        <p class="mt-3 text-sm text-slate-500">
          Misusing the report feature to silence someone (mass-reporting without valid reason) is itself a rule violation.
        </p>
      </div>
    </section>

    <!-- De-anonymization -->
    <section class="mb-8">
      <h2 class="section-title">De-anonymization policy</h2>
      <div class="prose-card border-l-4 border-l-amber-400">
        <p>
          In exceptional cases, a moderator may reveal the real email address behind a pseudonym.
          This is only permitted when the content involves:
        </p>
        <ul class="mt-2 space-y-1 text-sm list-disc list-inside text-slate-700">
          <li>Threats or intimidation</li>
          <li>Doxxing (revealing others' personal information)</li>
          <li>Illegal content under Estonian law</li>
          <li>Repeated severe abuse after prior moderation actions</li>
        </ul>
        <p class="mt-3">
          Every de-anonymization action is <strong>permanently logged</strong> with the moderator's identity,
          timestamp, and reason. This log cannot be deleted.
        </p>
      </div>
    </section>

    <!-- Footer note -->
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 text-center">
      Questions about the rules or your account? Contact the platform administrator.<br />
      <span class="text-xs mt-1 block">Rules may be updated during the pilot study. Last updated: April 2026.</span>
    </div>

  </div>
</template>

<script setup lang="ts">
const forbiddenRules = [
  {
    title: "Threats and harassment",
    description: "Threatening language, targeted insults, intimidation, or bullying directed at any person.",
  },
  {
    title: "Doxxing",
    description: "Revealing or attempting to reveal anyone's real name, email, student ID, or personal details without consent.",
  },
  {
    title: "Illegal content",
    description: "Anything that violates Estonian law or University of Tartu regulations.",
  },
  {
    title: "Impersonation",
    description: "Pretending to be another student, a lecturer, or a moderator.",
  },
  {
    title: "Spam and advertising",
    description: "Posting irrelevant content, repetitive messages, or promotions unrelated to coursework.",
  },
  {
    title: "Abuse of the reporting system",
    description: "Mass-reporting to silence another student without a valid reason.",
  },
];

const allowedRules = [
  {
    title: "Asking course-related questions",
    description: "Any honest question about assignments, concepts, deadlines, or study materials.",
  },
  {
    title: "Helping classmates",
    description: "Answering questions, sharing study tips, or explaining concepts.",
  },
  {
    title: "Constructive feedback",
    description: "Polite criticism of course structure, materials, or teaching style.",
  },
  {
    title: "Using anonymous or real name mode",
    description: "Both modes are valid. Your choice does not affect what you are allowed to post.",
  },
];

const consequenceTable = [
  {
    severity: "Minor",
    examples: "Single spam post, off-topic message",
    action: "Content hidden",
    badgeClass: "bg-yellow-100 text-yellow-800",
    actionClass: "text-yellow-700",
  },
  {
    severity: "Moderate",
    examples: "Harassment, repeated spam",
    action: "Content deleted, account reviewed",
    badgeClass: "bg-orange-100 text-orange-800",
    actionClass: "text-orange-700",
  },
  {
    severity: "Severe",
    examples: "Threats, doxxing, illegal content",
    action: "Content deleted + account permanently removed",
    badgeClass: "bg-red-100 text-red-800",
    actionClass: "text-red-700",
  },
];

const postingLimits = [
  {
    label: "Questions (threads)",
    lines: ["Max 3 per hour per course"],
  },
  {
    label: "Answers (comments)",
    lines: ["Max 10 per hour (across all courses)"],
  },
  {
    label: "Reports",
    lines: ["Max 5 per hour"],
  },
  {
    label: "New accounts (first 24 hours)",
    lines: ["Max 1 question per hour", "Max 5 answers per hour"],
  },
];
</script>

<style scoped>
.section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
}

.prose-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  color: #475569;
  font-size: 0.875rem;
  line-height: 1.6;
}

.info-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
}

.info-label {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.info-body {
  color: #475569;
  font-size: 0.875rem;
  line-height: 1.55;
}

.rule-card {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
}
</style>
