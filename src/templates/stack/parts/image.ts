import { getImageProps } from "next/image";
import type { Picture } from "../data";

/** Plain img attributes (and a narrow-screen source) a client island can take as props. */
export type ImageSet = {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
  alt: string;
  /** The profile's crop for narrow screens, below `media`. */
  mobile?: { srcSet: string; media: string; width: number; height: number };
};

export const NARROW = "(max-width: 640px)";

export function imageSet(
  picture: Picture,
  sizes: string,
  mobileSizes = sizes,
): ImageSet {
  const { props } = getImageProps({
    src: picture.src,
    alt: picture.alt,
    width: picture.width,
    height: picture.height,
    sizes,
  });
  const set: ImageSet = {
    src: String(props.src),
    srcSet: props.srcSet,
    sizes: props.sizes,
    width: picture.width,
    height: picture.height,
    alt: picture.alt,
  };
  if (picture.mobile) {
    const { props: small } = getImageProps({
      src: picture.mobile.src,
      alt: picture.alt,
      width: picture.mobile.width,
      height: picture.mobile.height,
      sizes: mobileSizes,
    });
    set.mobile = {
      srcSet: small.srcSet ?? String(small.src),
      media: NARROW,
      width: picture.mobile.width,
      height: picture.mobile.height,
    };
  }
  return set;
}
