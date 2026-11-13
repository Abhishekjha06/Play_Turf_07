/**
 * Editorial guides for /blog — data lives in blogPosts.json (shared with the
 * build-time agent-content generator). Content rules:
 *  - Only general, verifiable knowledge and real PlayTurf product behaviour.
 *  - No invented statistics, no fake reviews, no fabricated venue claims.
 *  - Each article answers a real question players ask (question in the
 *    heading, direct answer first, then detail).
 */
import postsJson from "./blogPosts.json";

export type BlogSection = {
  heading: string;
  body: string | string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  answer: string;
  datePublished: string;
  dateModified?: string;
  readMinutes: number;
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = postsJson as BlogPost[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
