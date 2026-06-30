/**
 * PII Redaction Utility
 * Strips emails, phone numbers, and names from user messages before
 * forwarding to the AI model. Keeps an audit log of what was redacted.
 */

export interface RedactedEntity {
  type: 'EMAIL' | 'PHONE' | 'NAME';
  value: string;
}

export interface RedactionResult {
  original: string;
  sanitized: string;
  redactedEntities: RedactedEntity[];
}

export function redactPII(text: string): RedactionResult {
  const redactedEntities: RedactedEntity[] = [];
  let sanitized = text;

  // 1. Email redaction
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  if (emails) {
    emails.forEach(email => {
      redactedEntities.push({ type: 'EMAIL', value: email });
      const escaped = email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escaped, 'g'), '[REDACTED_EMAIL]');
    });
  }

  // 2. Phone number redaction (multiple formats)
  const phoneRegex = /(\+?\d{1,3}[.\-\s]?)?\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4}/g;
  const phones = text.match(phoneRegex);
  if (phones) {
    phones.forEach(phone => {
      if (phone.replace(/[.\-\s()]/g, '').length >= 10) {
        redactedEntities.push({ type: 'PHONE', value: phone });
        const escaped = phone.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        sanitized = sanitized.replace(new RegExp(escaped, 'g'), '[REDACTED_PHONE]');
      }
    });
  }

  // 3. Name redaction — introductions like "I'm John", "my name is Jane Doe"
  const introRegexes = [
    /\b(?:i'm|i am|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /\b(?:call me|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  ];

  const reserved = new Set(['student', 'professional', 'entrepreneur', 'planner', 'assistant']);

  introRegexes.forEach(regex => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      if (name && !reserved.has(name.toLowerCase())) {
        const alreadyAdded = redactedEntities.some(e => e.value === name);
        if (!alreadyAdded) {
          redactedEntities.push({ type: 'NAME', value: name });
        }
        const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        sanitized = sanitized.replace(new RegExp(`\\b${escaped}\\b`, 'g'), '[REDACTED_NAME]');
      }
    }
  });

  return { original: text, sanitized, redactedEntities };
}

/**
 * Keyword-based archetype detection from chat messages.
 */
export type Archetype = 'Student' | 'Professional' | 'Entrepreneur';

export function detectArchetype(text: string): Archetype | null {
  const lower = text.toLowerCase();

  const scores = {
    Entrepreneur: 0,
    Professional: 0,
    Student: 0,
  };

  const keywords: Record<keyof typeof scores, string[]> = {
    Entrepreneur: ['startup', 'founder', 'co-founder', 'entrepreneur', 'pitch', 'investor', 'seed round', 'funding', 'business model', 'equity', 'venture', 'mvp'],
    Professional: ['professional', 'corporate', 'meeting', 'standup', 'manager', 'colleague', 'scrum', 'sprint', 'career', 'focus block', 'okr', 'deliverable', 'work-life'],
    Student: ['student', 'university', 'college', 'exam', 'quiz', 'lecture', 'assignment', 'homework', 'professor', 'study', 'semester', 'class', 'internship'],
  };

  (Object.keys(keywords) as (keyof typeof scores)[]).forEach(archetype => {
    keywords[archetype].forEach(kw => {
      const count = (lower.match(new RegExp(`\\b${kw}`, 'g')) || []).length;
      scores[archetype] += count;
    });
  });

  const max = Math.max(...Object.values(scores));
  if (max === 0) return null;

  const winner = (Object.keys(scores) as (keyof typeof scores)[]).find(k => scores[k] === max);
  return winner ?? null;
}
