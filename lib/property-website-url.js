const WEBSITE_BASE_URL = 'https://www.santosemello.com.br/imovel';

function buildPropertyWebsiteUrl(title, id) {
  const propertyId = String(id || '').trim();
  const slug = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) return `${WEBSITE_BASE_URL}/${encodeURIComponent(propertyId)}`;

  return `${WEBSITE_BASE_URL}/${slug}/${encodeURIComponent(propertyId)}`;
}

module.exports = { buildPropertyWebsiteUrl };
