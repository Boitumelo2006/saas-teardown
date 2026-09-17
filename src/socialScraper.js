/**
 * Scrapes and categorizes official social media profile links from page anchor objects.
 * @param {Array<{href: string, text: string}>} links - List of internal/external anchor links.
 * @returns {Object} Harvested social channels.
 */
export function extractSocialMedia(links = []) {
  const socialChannels = {
    twitter: null,
    linkedin: null,
    github: null,
    youtube: null,
    discord: null,
    producthunt: null,
  };

  if (!Array.isArray(links)) return socialChannels;

  for (const link of links) {
    const href = link.href?.trim();
    if (!href) continue;

    try {
      const url = new URL(href);
      const host = url.hostname.toLowerCase();

      if ((host.includes('twitter.com') || host.includes('x.com')) && !socialChannels.twitter) {
        socialChannels.twitter = href;
      } else if (host.includes('linkedin.com') && href.includes('/company/') && !socialChannels.linkedin) {
        socialChannels.linkedin = href;
      } else if (host.includes('github.com') && !socialChannels.github) {
        socialChannels.github = href;
      } else if ((host.includes('youtube.com') || host.includes('youtu.be')) && !socialChannels.youtube) {
        socialChannels.youtube = href;
      } else if ((host.includes('discord.gg') || host.includes('discord.com/invite')) && !socialChannels.discord) {
        socialChannels.discord = href;
      } else if (host.includes('producthunt.com') && !socialChannels.producthunt) {
        socialChannels.producthunt = href;
      }
    } catch {
      // Ignore invalid URL formats
    }
  }

  return socialChannels;
}