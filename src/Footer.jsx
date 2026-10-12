export default function Footer({ onDark = false }) {
  return (
    <p className={`foot${onDark ? ' dark' : ''}`}>
      Built by <b>Solomon Chukwuemeka</b>, C.E.O, <b>Rexx Hub</b>
    </p>
  );
}
