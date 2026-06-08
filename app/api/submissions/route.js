import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Submission } from '@/models';
import { fullSubmissionSchema } from '@/lib/wizardSchema';
import { computeStubbedPay } from '@/lib/server/computeStubbedPay';
import { mapSubmission } from '@/lib/server/mapSubmission';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = fullSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) errors[issue.path.join('.')] = issue.message;
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }
  const data = parsed.data;

  let result;
  try {
    result = computeStubbedPay(data);
  } catch (err) {
    console.error('[submissions] compute error:', err);
    return NextResponse.json({ ok: false, error: 'Could not compute result.' }, { status: 500 });
  }

  let saved;
  try {
    await connectDB();
    const doc = mapSubmission(data);
    doc.computedResult = {
      startingSalary: result.startingSalary,
      currentSalary: result.currentSalary,
      traceLines: result.traceLines,
      isMock: true,
      computedAt: new Date(),
    };
    doc.status_flow = 'computed';
    saved = await new Submission(doc).save();
  } catch (err) {
    console.error('[submissions] save error:', err);
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      return NextResponse.json({ ok: false, error: 'Submission failed schema validation on the server.' }, { status: 422 });
    }
    return NextResponse.json({ ok: false, error: 'Could not save submission. Please try again.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      submission: {
        id: saved._id.toString(),
        isMock: true,
        startingSalary: result.startingSalary,
        currentSalary: result.currentSalary,
        traceLines: result.traceLines,
      },
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed. Use POST.' }, { status: 405 });
}
