export default function DemoBanner() {
  return (
    <div
      role="alert"
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900"
    >
      ⚠ DEMO MODE — calculations are illustrative placeholders, not real pay
      fixations. Payments use Razorpay Test Mode and will not be charged.
    </div>
  );
}