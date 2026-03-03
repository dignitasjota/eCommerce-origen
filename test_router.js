const dynamicSlug = ['packs-ahorro'];
const prefix = '';

let pageSlug = null;
if (prefix === '' && dynamicSlug.length === 1) {
    pageSlug = dynamicSlug[0];
} else if (prefix !== '' && dynamicSlug.length === 2 && dynamicSlug[0] === prefix) {
    pageSlug = dynamicSlug[1];
}
console.log({ pageSlug });
