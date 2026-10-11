export default function Footer({ onDark = false }) {
  return (
    <p className={`foot${onDark ? ' dark' : ''}`}>
      Built by Rexx Hub
    </p>
  );
}
