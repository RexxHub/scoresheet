import logo from './assets/logo.png';

export default function Logo({ size = 'sm' }) {
  return <img className={`logo ${size}`} src={logo} alt="The Wins School logo" />;
}
