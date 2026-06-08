import { NextResponse } from 'next/server';
import { fullSubmissionSchema } from '@/lib/wizardSchema';
import { computeStubbedPay } from '@/lib/server/computeStubbedPay';

export async function POST(request) {
  // 1) Parse JSON safely — never assume the body is well-formed.
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  // 2) Server-side validation using the SAME Zod schema the client uses.
  //    The server trusts nothing the client claims to have validated.
  const parsed = fullSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join('.')] = issue.message;
    }
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const data = parsed.data;

  // 3) Compute the (stubbed) result.
  let result;
  try {
    result = computeStubbedPay(data);
  } catch (err) {
    console.error('[submissions] compute error:', err);
    return NextResponse.json(
      { ok: false, error: 'Could not compute result.' },
      { status: 500 }
    );
  }

  // 4) Return the teaser payload.
  //    DB persistence (saving a Submission doc) is the next sub-step — see notes.
  return NextResponse.json(
    {
      ok: true,
      submission: { id: 'stub-' + Date.now(), isMock: true, ...result },
    },
    { status: 200 }
  );
}

// Explicit 405 for other verbs.
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}