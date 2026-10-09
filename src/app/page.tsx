import Home from "@/portfolio/template-home.generated";
import { templateContext } from "@/core/template-context";

export default function Page() {
  return <Home context={templateContext} />;
}
