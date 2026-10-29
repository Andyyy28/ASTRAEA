// Mirror only these existing reference URLs. Preserve uploaded and custom images.
const referenceImages = {
  "https://felt.co.nz/user-images/itemuploads/u315313/i1093081/l.jpg": "/images/flowers/anthurium.jpg",
  "https://handmadegifts.store/cdn/shop/files/8_ebbe1c85-2745-400d-83dd-0553a00affb0.png?v=1757683060&width=600": "/images/flowers/daisy.png",
  "https://handmadegifts.store/cdn/shop/files/WhatsAppImage2025-08-03at12.41.05AM.jpg?v=1754153467&width=600": "/images/flowers/hibiscus.jpg",
  "https://craftimate.com.au/cdn/shop/files/MG_3751.png?v=1767709736&width=600": "/images/flowers/lavender-v1.png",
  "https://i.etsystatic.com/56673320/r/il/9e623a/6532049172/il_794xN.6532049172_63tc.jpg": "/images/flowers/lavender-v2.jpg",
  "https://img.staticdj.com/41a68117445eff855aba737865be8d71.jpg": "/images/flowers/lily.webp",
  "https://i.etsystatic.com/34039969/r/il/99630c/7305065769/il_800x800.7305065769_jdln.jpg": "/images/flowers/lotus.jpg",
  "https://craftimate.com.au/cdn/shop/files/Flower11_0013_Hoa_0093__MG_3093.jpg?v=1768811931&width=600": "/images/flowers/poppy.jpg",
  "https://i.etsystatic.com/60724840/r/il/debdc9/7317256812/il_fullxfull.7317256812_pim7.jpg": "/images/flowers/stargazer.jpg",
  "https://afzaai.in/cdn/shop/files/4176308A-B0E3-4571-9D6E-EA204B84BC27.jpg?v=1767906558&width=600": "/images/flowers/sundrop.jpg",
  "https://i.pinimg.com/originals/15/27/ed/1527ed06666dd8e98c8867e704e870f0.jpg": "/images/flowers/tiger-lily.jpg"
};

export const resolveInventoryImageUrl = url => Object.hasOwn(referenceImages, url) ? referenceImages[url] : url;
