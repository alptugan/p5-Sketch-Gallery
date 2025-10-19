// Helper function to generate URL-friendly slugs from titles and author
function normalizeAscii(str) {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[İ]/g, "I")
        .replace(/[ı]/g, "i");
}

function generateSlug(title, author) {
    const lastName = normalizeAscii(author).trim().split(" ").pop().toLowerCase();
    const titleSlug = normalizeAscii(title)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${titleSlug}-${lastName}`;
}

const sketchesData = [
    {
        author: "Elif Erpulat",
        title: "Frog",
        description: "Week 1 abstraction assignment in p5.js",
        url: "https://openprocessing.org/sketch/2376645/embed",
        width: 600,
        height: 600,
        week: "week2"
    },
    {
        author: "Ada Tıngaz",
        title: "Checkered Paprika",
        description: "",
        url: "https://editor.p5js.org/ada.tingaz/full/I2N_Nwb6W",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Aslı Özcan",
        title: "Turtle",
        description: "",
        url: "https://editor.p5js.org/asli.ozcan/full/ufM-LQ5Bj",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Baran Bülbül",
        title: "week2 abstraction",
        description: "",
        url: "https://editor.p5js.org/Barannn/full/Pg8FhUxqo",
        width: 1020,
        height: 1020,
        week: "week2"
    },
    {
        author: "Buse Özdemir",
        title: "week2 assignment",
        description: "",
        url: "https://editor.p5js.org/buse.ozdemir.33629/full/QETp7SwF8",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Ceran Erdi",
        title: "Flower",
        description: "",
        url: "https://editor.p5js.org/ceran/full/QYY3TZuHI",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Deniz Mutlu",
        title: "Crub",
        description: "",
        url: "https://editor.p5js.org/denizmutlu/full/NBXsFJiWo",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Ece Matlı",
        title: "week2",
        description: "",
        url: "https://editor.p5js.org/ecematli/full/tGdd9MIjX",
        width: 800,
        height: 800,
        week: "week2"
    },
    {
        author: "Eda Erginoğlu",
        title: "week2 abstraction",
        description: "",
        url: "https://editor.p5js.org/eda.erginoglu/full/mVAlnLvO9",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Farida Hamed",
        title: "Candle",
        description: "",
        url: "https://editor.p5js.org/faridahamed/full/ktnaeAcUi",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Ilgınsu Gündüzalp",
        title: "Week2 abstraction assignment",
        description: "",
        url: "https://editor.p5js.org/ilginsugunduzalp/full/r5TvD1qGX",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Imran Nawaz",
        title: "Glaze Resonance",
        description: "",
        url: "https://editor.p5js.org/iman.nawaz/full/l4BQ3QhMe",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Münazza Şirin",
        title: "Cat",
        description: "",
        url: "https://editor.p5js.org/munazza.shirin/full/y-8_bApaH",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Nehir Gelişin",
        title: "Composition",
        description: "",
        url: "https://editor.p5js.org/nehir.gelisin/full/up-mE5cH9",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Umut Gelir",
        title: "Fish",
        description: "",
        url: "https://editor.p5js.org/tumurileg/full/yPM3SvNLr",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Azra Akoğlu",
        title: "Grapes",
        description: "",
        url: "https://editor.p5js.org/azra.akoglu/full/alZHFy1wQ",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Baran Ay",
        title: "The Sun",
        description: "",
        url: "https://editor.p5js.org/baranay/full/THn3NDgr7",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Bersu Güzey",
        title: "Lamp",
        description: "",
        url: "https://editor.p5js.org/bersuguzey/full/Ifo7i0nfD",
        width: 900,
        height: 900,
        week: "week2"
    },
    {
        author: "Bilal Mushtaque",
        title: "Abstract Fighter",
        description: "",
        url: "https://editor.p5js.org/bilal.mushtaque/full/jDgan7Pm7",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Cemre Toraman",
        title: "Week2 Assignment",
        description: "",
        url: "https://editor.p5js.org/cemre.toraman/full/h5jcr5gUb",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Ece Usta",
        title: "Pokeball",
        description: "",
        url: "https://editor.p5js.org/ece.usta/full/TkzWzJ_EO",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Mert Cambol",
        title: "Portrait",
        description: "",
        url: "https://editor.p5js.org/mertcambol/full/d7Ya8w1g8",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Nur Akçay",
        title: "Robot",
        description: "",
        url: "https://editor.p5js.org/meleknurakcay/full/z6m53tSqA",
        width: 450,
        height: 450,
        week: "week2"
    },
    {
        author: "Nurdan Çelik",
        title: "Mickey",
        description: "",
        url: "https://editor.p5js.org/nurdancelik90/full/hxnUkIrZV",
        width: 1080,
        height: 1080,
        week: "week2"
    },
    {
        author: "Alper Karaman",
        title: "Owl",
        description: "",
        url: "https://editor.p5js.org/alperek/full/WiYMlzmuZ",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Cemre Toraman",
        title: "Elephant",
        description: "",
        url: "https://editor.p5js.org/cemre.toraman/full/_lMO3Hek7",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Doğa Özbeklik",
        title: "Catish",
        description: "",
        url: "https://editor.p5js.org/doga.ozbeklik/full/qzDPAB6sw",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "İpek Öğetürk",
        title: "Bird",
        description: "",
        url: "https://editor.p5js.org/ipekogeturk/full/fiW_tDEQu",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Kağan Akdoğan",
        title: "Abstract Cat ",
        description: "",
        url: "https://editor.p5js.org/KaanAkdogan/full/wjKxexJ9j",
        width: 900,
        height: 900,
        week: "week3"
    },
    {
        author: "Mert Cambol",
        title: "Moose",
        description: "",
        url: "https://editor.p5js.org/mertcambol/full/FETDP9amn",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Nisa Esmer",
        title: "Duck",
        description: "",
        url: "https://editor.p5js.org/nisaemer/full/oeeGM0_VS",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Rüya Mihdavi",
        title: "Cat",
        description: "",
        url: "https://editor.p5js.org/ruyaghenamihdavi/full/T4dFsOvrn",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Umut Gelir",
        title: "Scorpion",
        description: "",
        url: "https://editor.p5js.org/tumurileg/full/INeDprn-G",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Nehir Gelişin",
        title: "Squirrel",
        description: "",
        url: "https://editor.p5js.org/nehir.gelisin/full/E_j4ImEir",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Münazza Şirin",
        title: "Owl Figure",
        description: "",
        url: "https://editor.p5js.org/munazza.shirin/full/UIUQ9fwGD",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Muhammad İmran",
        title: "Cat",
        description: "",
        url: "https://editor.p5js.org/HashirtheDev/full/v0dx_y86W",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Ilgınsu Gündüzalp",
        title: "Seal",
        description: "",
        url: "https://editor.p5js.org/ilginsugunduzalp/full/Nv4z7Lx-W",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Farida Hamed",
        title: "Fox",
        description: "",
        url: "https://editor.p5js.org/faridahamed/full/5xfCCqmIw",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Eda Erginoğlu",
        title: "Yellow Cat",
        description: "",
        url: "https://editor.p5js.org/eda.erginoglu/full/J988e_mkl",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Buse Özdemir",
        title: "Parrot",
        description: "",
        url: "https://editor.p5js.org/buse.ozdemir.33629/full/VR9dvU-Vv",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Baran Bülbül",
        title: "Cat Face",
        description: "",
        url: "https://editor.p5js.org/Barannn/full/bagZYPjVT",
        width: 900,
        height: 900,
        week: "week3"
    },
    {
        author: "Alp Eroğlu",
        title: "Scorpion",
        description: "",
        url: "https://openprocessing.org/sketch/2753313/embed",
        width: 800,
        height: 800,
        week: "week3"
    },
    {
        author: "Ada Tıngaz",
        title: "Abstract Fish",
        description: "",
        url: "https://editor.p5js.org/ada.tingaz/full/Eyf01mUMJ",
        width: 800,
        height: 800,
        week: "week3"
    }
];

const foldersData = [
    {
        id: "week1",
        name: "Week 1 - Introduction",
        isDefault: false
    },
    {
        id: "week2",
        name: "Week 2 - Abstraction",
        isDefault: false
    },
    {
        id: "week3",
        name: "Week 3 - Computational Thinking",
        isDefault: true
    }
];

const Config = {
    sketches: sketchesData.map((sketch) => ({
        ...sketch,
        slug: generateSlug(sketch.title, sketch.author),
    })),
    folders: foldersData,
};

export default Config;
