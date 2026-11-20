const BUTTONS = [
  { cmd: 'bold', label: <strong>B</strong>, title: 'Bold (Ctrl+B)', format: true },
  { cmd: 'italic', label: <em>I</em>, title: 'Italic (Ctrl+I)', format: true },
  { cmd: 'underline', label: <u>U</u>, title: 'Underline (Ctrl+U)', format: true },
  'sep',
  { cmd: 'h1', label: 'Heading', title: 'Heading 1' },
  { cmd: 'h2', label: 'Subheading', title: 'Heading 2' },
  { cmd: 'paragraph', label: 'Normal', title: 'Normal text' },
  'sep',
  { cmd: 'ul', label: '• List', title: 'Bulleted list' },
  { cmd: 'ol', label: '1. List', title: 'Numbered list' },
];

export default function Toolbar({ onCommand, active, disabled }) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {BUTTONS.map((item, index) =>
        item === 'sep' ? (
          <span key={`sep-${index}`} className="sep" aria-hidden="true" />
        ) : (
          <button
            key={item.cmd}
            type="button"
            title={item.title}
            aria-label={item.title}
            aria-pressed={item.format ? Boolean(active[item.cmd]) : undefined}
            disabled={disabled}
            // Keep the text selection when the button is clicked.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCommand(item.cmd)}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
