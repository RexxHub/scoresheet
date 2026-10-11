export default function Footer({ onDark = false }) {
  return <p className={`foot${onDark ? ' dark' : ''}`}>Built by <b>REX HUB</b></p>;
}
