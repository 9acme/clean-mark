const meta = require('./meta');
const read = require('./read');
const util = require('./util');
const cheerio = require('cheerio');
const extractor = require('a-extractor');

/**
 *
 * @param {*} link 输入的链接
 * @param {*} options 配置信息
 * @returns
 */
module.exports = async function clean(link, options = {}) {
  /**
   * Main function;
   * Fetch, broom, meta, sanitize, minimize, content, markdown.
   */

  const { useDatabase, fileType } = options;
  let { html } = options;
  let aex, article, dict;

  if (!link) {
    link = options.link;
  }
  if (!link && !html) {
    throw new Error('Clean needs either LINK or HTML');
  }

  if (!html) {
    html = await util.fetchUri(link);
  }

  try {
    // 获取文章作者信息
    dict = await meta(html);
  } catch (err) {
    throw new Error(`extracting meta: ${err.message}`);
  }

  html = util.saneHtml(html);
  // 这里还是有中文注释的
  html = util.minHtml(html);

  // Unwanted elements
  const dom = util.broomHtml(html);

  // Is the HOST in the A-Extractor database?
  if (useDatabase) {
    aex = extractor.extract(dom, link);
  }

  if (aex && aex.content) {
    // Use A-Extractor patterns
    dict.date = aex.date;
    dict.author = aex.author;
    const $ = cheerio.load(aex.content);
    article = $.root();
  } else if (options.proc !== false) {
    // Use Readability auto-detection
    try {
      article = (await read(dom)).getContent();
    } catch (err) {
      throw new Error(`extracting content: ${err.message}`);
    }
  }

  if (article && article.length > 0) {
    // 1, or more elements?
    if (article.length === 1) {
      html = article.html();
    } else if (article.length > 1) {
      html = article
        .map((i, a) => cheerio.load(a).html())
        .get()
        .join(' ');
    }
  }

  if (fileType === 'text') {
    dict.text = html
      .replace(/<\s*br[^>]?>/, '\n\n')
      .replace(/(<([^>]+)>)/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  } else if (fileType === 'html') {
    dict.text = html;
  } else {
    dict.text = util.convertMd(html);
  }
  return dict;
};
