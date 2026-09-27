/** Hosted demo only: says what is real here and what is simulated. */
export function DemoBanner() {
  return (
    <div
      role="note"
      style={{
        flexShrink: 0,
        minHeight: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "4px 12px",
        padding: "6px 16px",
        background: "var(--working-bg)",
        color: "var(--working)",
        fontSize: 14,
        lineHeight: 1.4,
        textAlign: "center",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <span>
        <strong style={{ fontWeight: 600 }}>Hosted demo.</strong> The scan of the demo shop app and the red
        arrows are real. Make it so is simulated here: no IBM Bob call, and the Bobcoin figure is illustrative.
      </span>
      <a
        href="https://github.com/SolaimanK05/etch#run-it"
        target="_blank"
        rel="noopener"
        style={{ color: "var(--working)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        Run it locally with Bob
      </a>
    </div>
  );
}
