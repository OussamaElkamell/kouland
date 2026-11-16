import { notFound } from "next/navigation";

/** Unknown addresses under a language (/fr/anything) show the translated 404 page. */
export default function CatchAll() {
  notFound();
}
