import { createElement, type ReactNode } from "react";
import Image from "next/image";
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import dimensionFile from "@/lib/body-image-dimensions.json";

const BODY_IMAGE_SIZES = "(max-width: 42rem) calc(100vw - 3rem), 39rem";

const dimensionList = dimensionFile as Record<string, { width: number; height: number }>;

/**
 * Book-cover and decorative files under post-images/graphics/.
 * Set from a visual check of one graphic through the optimiser.
 * Photographs always use next/image.
 */
export const optimiseBodyGraphics = false;

type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type ElementNode = DefaultTreeAdapterTypes.Element;

export type BodyImageProps = {
  src: string;
  alt: string;
  widthAttr?: string;
  heightAttr?: string;
  className?: string;
  pinMedia?: string;
  pinUrl?: string;
};

function positivePixels(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function listedDimensions(src: string): { width: number; height: number } | null {
  const listed = dimensionList[src] ?? dimensionList[src.trim()];
  if (!listed?.width || !listed?.height) return null;
  return listed;
}

export function isBodyGraphic(src: string): boolean {
  return src.includes("/post-images/graphics/");
}

export function resolveBodyDimensions(
  src: string,
  widthAttr?: string,
  heightAttr?: string
): { width: number; height: number } | null {
  const width = positivePixels(widthAttr);
  const height = positivePixels(heightAttr);
  if (width && height) return { width, height };
  return listedDimensions(src);
}

function canOptimise(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("//");
  return src.startsWith("https://");
}

export function BodyImage({
  src,
  alt,
  widthAttr,
  heightAttr,
  className,
  pinMedia,
  pinUrl,
}: BodyImageProps) {
  const dimensions = resolveBodyDimensions(src, widthAttr, heightAttr);
  const graphic = isBodyGraphic(src);
  const useOptimiser = Boolean(dimensions) && canOptimise(src) && (optimiseBodyGraphics || !graphic);
  const pinProps = {
    ...(pinMedia !== undefined ? { "data-pin-media": pinMedia } : {}),
    ...(pinUrl !== undefined ? { "data-pin-url": pinUrl } : {}),
  };
  const classProps = className ? { className } : {};

  if (!useOptimiser || !dimensions) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        {...(dimensions
          ? {
              width: dimensions.width,
              height: dimensions.height,
              style: { width: "100%", height: "auto" },
            }
          : {})}
        {...classProps}
        {...pinProps}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      sizes={BODY_IMAGE_SIZES}
      loading="lazy"
      decoding="async"
      style={{ width: "100%", height: "auto" }}
      {...classProps}
      {...pinProps}
    />
  );
}

function renderNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeName === "#text" && "value" in node) return node.value;
  if (node.nodeName === "#comment") return null;
  if (!("tagName" in node)) return null;

  if (node.nodeName === "img") {
    const attrs = Object.fromEntries(node.attrs.map((attr) => [attr.name, attr.value]));
    return (
      <BodyImage
        key={key}
        src={attrs.src ?? ""}
        alt={attrs.alt ?? ""}
        widthAttr={attrs.width}
        heightAttr={attrs.height}
        className={attrs.class}
        pinMedia={Object.prototype.hasOwnProperty.call(attrs, "data-pin-media") ? attrs["data-pin-media"] : undefined}
        pinUrl={Object.prototype.hasOwnProperty.call(attrs, "data-pin-url") ? attrs["data-pin-url"] : undefined}
      />
    );
  }

  const element = node as ElementNode;
  const props: Record<string, unknown> = { key };
  for (const attr of element.attrs) {
    if (attr.name === "class") props.className = attr.value;
    else props[attr.name] = attr.value;
  }
  const children = element.childNodes.map((child, index) => renderNode(child, index));
  return createElement(element.tagName, props, ...children);
}

export function PostBody({ html }: { html: string }) {
  const fragment = parseFragment(html);
  return <>{fragment.childNodes.map((node, index) => renderNode(node, index))}</>;
}
