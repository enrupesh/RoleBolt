import * as React from "react";

type Props = {
  data: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
};

export function JsonLd({ data, id }: Props) {
  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
