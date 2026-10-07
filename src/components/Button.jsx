import { BUTTON_STYLES } from "../theme";

export default function Button({ variant = "secondary", style, children, type = "button", ...props }) {
  return <button type={type} {...props} style={{ ...BUTTON_STYLES[variant], ...style }}>{children}</button>;
}
