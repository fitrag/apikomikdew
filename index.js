const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

// ============ CONFIG ============
const CONFIG = {
  PORT: process.env.PORT || 8080,
  BASE_URL: "https://komikdewasa.mom",
  AUTHOR: "Fadila Fitra Kusuma Jaya",
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// ============ HELPERS ============
const fetchHTML = async (url) => {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    timeout: 30000,
  });
  return cheerio.load(data);
};

const sendError = (res, message = "Terjadi kesalahan atau halaman tidak ditemukan", error = null) => {
  console.error("Error:", message, error?.message || "");
  res.status(500).json({ message, author: CONFIG.AUTHOR });
};

const cleanLink = (href, prefix) => {
  return (href || "").replace(`${CONFIG.BASE_URL}/${prefix}/`, "").replace("/", "");
};

const getImage = ($el, selector) => {
  const img = $el.find(selector);
  return img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || "";
};

// ============ PARSERS ============
// Parser untuk Latest Update (.utao.styletwo)
const parseMangaUpdate = ($) => {
  const list = [];
  $(".bixbox .listupd .utao.styletwo").each((_, el) => {
    const item = $(el);
    list.push({
      judul: item.find(".uta .luf a.series h4").text().trim(),
      img: getImage(item, ".uta .imgu a img"),
      type: item.find(".uta .imgu a span.type").attr("class")?.replace("type ", "") || "Manga",
      status: item.find(".uta .luf .statusind").text().trim(),
      chapter: item.find(".uta .luf ul li:first-child a").text().trim(),
      chapter_update: item.find(".uta .luf ul li:first-child span").text().trim(),
      link: cleanLink(item.find(".uta .luf a.series").attr("href"), "komik"),
    });
  });
  return list;
};

// Parser untuk Project Update (.bs.styletere)
const parseMangaProject = ($) => {
  const list = [];
  $(".bixbox .listupd .bs.styletere").each((_, el) => {
    const item = $(el);
    const typeClass = item.find(".limit span.type").attr("class") || "";
    const type = typeClass.replace("type ", "").trim() || "Manga";
    
    list.push({
      judul: item.find(".bigor .tt").text().trim(),
      img: getImage(item, ".limit img"),
      type,
      status: item.find(".limit span.status").text().trim() || "Ongoing",
      chapter: item.find(".bigor .adds .epxs").text().trim(),
      chapter_update: item.find(".bigor .adds .epxdate").text().trim(),
      link: cleanLink(item.find(".bsx > a").attr("href"), ""),
    });
  });
  return list;
};

// Parser untuk Popular Today (.popularslider .bs)
const parsePopularToday = ($) => {
  const list = [];
  $(".popularslider .bs").each((_, el) => {
    const item = $(el);
    const typeClass = item.find(".limit span.type").attr("class") || "";
    const type = typeClass.replace("type ", "").trim() || "Manga";
    
    list.push({
      judul: item.find(".bigor .tt").text().trim(),
      img: getImage(item, ".limit img"),
      type,
      status: item.find(".limit span.status").text().trim() || "Ongoing",
      chapter: item.find(".bigor .adds .epxs").text().trim(),
      rating: item.find(".bigor .adds .rt .numscore").text().trim(),
      link: cleanLink(item.find(".bsx > a").attr("href"), "komik"),
    });
  });
  return list;
};

// ============ APP SETUP ============
const app = express();
app.use(cors());

// ============ ROUTES ============
app.get("/", (_, res) => {
  res.json({ message: "Hallo 👋", author: CONFIG.AUTHOR });
});

// Manga Update (Latest Update - .utao.styletwo)
app.get("/manga/v2/manga-update", async (_, res) => {
  try {
    const $ = await fetchHTML(CONFIG.BASE_URL);
    res.json({
      author: CONFIG.AUTHOR,
      url: CONFIG.BASE_URL,
      manga_list: parseMangaUpdate($),
    });
  } catch (err) {
    sendError(res, "Gagal mengambil data manga update", err);
  }
});

// Manga Project (Project Update - .bs.styletere)
app.get("/manga/v2/manga-project", async (_, res) => {
  try {
    const $ = await fetchHTML(CONFIG.BASE_URL);
    res.json({
      author: CONFIG.AUTHOR,
      url: CONFIG.BASE_URL,
      manga_list: parseMangaProject($),
    });
  } catch (err) {
    sendError(res, "Gagal mengambil data manga project", err);
  }
});

// Popular Today (.popularslider)
app.get("/manga/v2/popular-today", async (_, res) => {
  try {
    const $ = await fetchHTML(CONFIG.BASE_URL);
    res.json({
      author: CONFIG.AUTHOR,
      url: CONFIG.BASE_URL,
      manga_list: parsePopularToday($),
    });
  } catch (err) {
    sendError(res, "Gagal mengambil data popular today", err);
  }
});

// Search
app.get("/manga/v2/page/:id/:keyword", async (req, res) => {
  const { id, keyword } = req.params;
  const pageId = parseInt(id);
  const url = `${CONFIG.BASE_URL}/page/${pageId}/?s=${keyword}`;

  try {
    const $ = await fetchHTML(url);
    res.json({
      author: CONFIG.AUTHOR,
      url,
      currentPage: pageId,
      nextPage: pageId + 1,
      manga_list: parseMangaUpdate($),
    });
  } catch (err) {
    sendError(res, "Gagal mencari manga", err);
  }
});

// Daftar Komik
app.get("/manga/v2/page/:id", async (req, res) => {
  const pageId = parseInt(req.params.id);
  const url = pageId === 1
    ? `${CONFIG.BASE_URL}/komik/`
    : `${CONFIG.BASE_URL}/komik/page/${pageId}/`;

  try {
    const $ = await fetchHTML(url);
    res.json({
      author: CONFIG.AUTHOR,
      url,
      currentPage: pageId,
      nextPage: pageId + 1,
      manga_list: parseMangaUpdate($),
    });
  } catch (err) {
    sendError(res, "Gagal mengambil daftar komik", err);
  }
});


// Detail Komik
app.get("/manga/v2/detail/:slug", async (req, res) => {
  const { slug } = req.params;
  const url = `${CONFIG.BASE_URL}/komik/${slug}`;

  try {
    const $ = await fetchHTML(url);
    
    // Helper untuk ambil data dari table
    const getTableData = (label) => {
      const row = $(`.infotable tr:contains('${label}')`);
      return row.find("td:last-child").text().trim();
    };

    // Genres
    const genres = [];
    $(".seriestugenre a").each((_, el) => genres.push($(el).text().trim()));

    // Chapters
    const chapters = [];
    $("#chapterlist ul li").each((_, el) => {
      const item = $(el);
      chapters.push({
        chapter_name: item.find(".chapternum").text().trim(),
        chapter_update: item.find(".chapterdate").text().trim(),
        chapter_link: cleanLink(item.find("a").attr("href"), ""),
      });
    });

    res.json({
      title: $(".entry-title").text().trim(),
      alternative: getTableData("Alternative"),
      img: getImage($(".thumb"), "img"),
      status: getTableData("Status"),
      type: getTableData("Type"),
      released: getTableData("Released"),
      author: getTableData("Author"),
      rating: $(".rating-prc .num").text().trim(),
      views: $(".ts-views-count").text().trim(),
      genres,
      sinopsis: $(".entry-content-single p").text().trim(),
      chapter_list: chapters,
    });
  } catch (err) {
    sendError(res, "Gagal mengambil detail komik", err);
  }
});

// Chapter Images
app.get("/manga/v2/chapter/:slug", async (req, res) => {
  const { slug } = req.params;
  const url = `${CONFIG.BASE_URL}/${slug}`;

  try {
    const $ = await fetchHTML(url);
    
    // Extract data dari ts_reader.run({...})
    let readerData = null;
    $("script").each((_, el) => {
      const scriptContent = $(el).html();
      if (scriptContent && scriptContent.includes("ts_reader.run(")) {
        const match = scriptContent.match(/ts_reader\.run\((\{.*?\})\);/s);
        if (match && match[1]) {
          try {
            readerData = JSON.parse(match[1]);
          } catch (e) {
            console.error("Failed to parse ts_reader data:", e.message);
          }
        }
      }
    });

    if (!readerData) {
      return sendError(res, "Data chapter tidak ditemukan");
    }

    // Extract images dari sources
    const images = [];
    if (readerData.sources && readerData.sources.length > 0) {
      const source = readerData.sources[0];
      source.images.forEach((imgUrl, idx) => {
        images.push({
          chapter_image: imgUrl,
          chapter_number: idx,
        });
      });
    }

    res.json({
      judul: slug.replace(/-/g, " ").replace(/chapter/i, "Chapter"),
      total_pages: images.length,
      prevlink: readerData.prevUrl ? cleanLink(readerData.prevUrl, "") : "",
      nextlink: readerData.nextUrl ? cleanLink(readerData.nextUrl, "") : "",
      chapter: images,
    });
  } catch (err) {
    sendError(res, "Gagal mengambil chapter", err);
  }
});

// ============ START SERVER ============
app.listen(CONFIG.PORT, () => {
  console.log(`🚀 Server running on port ${CONFIG.PORT}`);
  console.log(`📖 Base URL: ${CONFIG.BASE_URL}`);
});
