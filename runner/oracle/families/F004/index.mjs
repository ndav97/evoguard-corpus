// Oráculo de F004 (asistente de registro). Planes vinculados por hash a oracle/F004/*.cases.yaml (spec-lock.json).
// Sin listas con IDs: los planes accionan campos, botones y radios del contrato y leen los status «Paso», «Resumen»
// y «Confirmación». Opciones de país/provincia y precios de planes se derivan del fixture; el resto se transcribe del caso.
import { labeled, amount } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F004';
export const FIXTURE = 'fixtures/signup-options.json';
export const FIXTURE_SCHEMA = {
  type: 'object',
  properties: {
    countries: {
      type: 'array', minItems: 6, maxItems: 6,
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', pattern: '^[A-Z]{2}$' },
          name: { type: 'string', minLength: 1 },
          regions: {
            type: 'array', maxItems: 8,
            items: {
              type: 'object',
              properties: { code: { type: 'string', pattern: '^[a-z]+(-[a-z]+)*$' }, name: { type: 'string', minLength: 1 } },
              required: ['code', 'name'],
              additionalProperties: false
            }
          }
        },
        required: ['code', 'name', 'regions'],
        additionalProperties: false
      }
    },
    plans: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          code: { enum: ['basico', 'pro', 'equipo'] },
          name: { type: 'string', minLength: 1 },
          monthly_price: { type: 'number', exclusiveMinimum: 0 },
          min_age: { type: 'integer', minimum: 13, maximum: 120 },
          requires_company: { type: 'boolean' }
        },
        required: ['code', 'name', 'monthly_price', 'min_age', 'requires_company'],
        additionalProperties: false
      }
    },
    free_email_domains: {
      type: 'array', minItems: 1, maxItems: 10, uniqueItems: true,
      items: { type: 'string', pattern: '^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$' }
    }
  },
  required: ['countries', 'plans', 'free_email_domains'],
  additionalProperties: false
};

export function checkFixture(options, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const { countries, plans, free_email_domains: domains } = options;
  const summary = family.fixture.summary ?? {};
  demand(JSON.stringify(countries.map(c => c.code)) === JSON.stringify(summary.country_codes), 'Países distintos de los declarados');
  demand(new Set(countries.map(c => c.code)).size === countries.length && new Set(countries.map(c => c.name)).size === countries.length, 'Países repetidos');
  demand(JSON.stringify(countries.filter(c => c.regions.length).map(c => c.code)) === JSON.stringify(summary.countries_with_regions), 'Países con regiones distintos de los declarados');
  demand(countries.reduce((n, c) => n + c.regions.length, 0) === summary.region_count, 'Número de regiones distinto del declarado');
  const regionCodes = countries.flatMap(c => c.regions.map(r => r.code));
  demand(new Set(regionCodes).size === regionCodes.length, 'Códigos de región repetidos');
  const names = [...countries.map(c => c.name), ...countries.flatMap(c => c.regions.map(r => r.name))];
  demand(names.every(a => names.every(b => a === b || !b.includes(a))), 'Nombres de país/región contenidos unos en otros');
  demand(JSON.stringify(plans.map(p => p.code)) === JSON.stringify(summary.plan_codes), 'Planes distintos de los declarados');
  demand(plans.every(p => Math.abs(p.monthly_price * 100 - Math.round(p.monthly_price * 100)) < 1e-6), 'Precio de plan con más de dos decimales');
  demand(new Set(plans.map(p => p.monthly_price)).size === plans.length, 'Precios de plan repetidos');
  demand(plans[0].min_age === 13 && !plans[0].requires_company, 'El primer plan (por defecto) debe admitir cualquier edad válida y no requerir empresa');
  demand(plans.some(p => p.min_age > 13) && plans.some(p => p.requires_company), 'Faltan planes con edad mínima o con empresa');
  demand(domains.length === summary.free_email_domain_count, 'Número de dominios gratuitos distinto del declarado');
  demand(countries.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  step: { role: 'status', name: 'Paso' },
  email: { role: 'textbox', name: 'Correo' },
  password: { role: 'field', name: 'Contraseña' },
  next: { role: 'button', name: 'Siguiente' },
  name: { role: 'textbox', name: 'Nombre' },
  age: { role: 'spinbutton', name: 'Edad' },
  country: { role: 'combobox', name: 'País' },
  back: { role: 'button', name: 'Atrás' },
  summary: { role: 'status', name: 'Resumen' },
  submit: { role: 'button', name: 'Enviar' },
  confirmation: { role: 'status', name: 'Confirmación' },
  province: { role: 'combobox', name: 'Provincia' },
  basic: { role: 'radio', name: 'Básico' },
  pro: { role: 'radio', name: 'Pro' },
  team: { role: 'radio', name: 'Equipo' },
  company: { role: 'textbox', name: 'Empresa' }
};
export const LISTS = {};

export const context = options => ({
  options,
  countryOptions: ['', ...options.countries.map(c => c.code)],
  regionOptions: code => ['', ...options.countries.find(c => c.code === code).regions.map(r => r.code)],
  price: code => options.plans.find(p => p.code === code).monthly_price
});

// ---------- utilidades ----------
const STEPS = ['Cuenta', 'Perfil', 'Resumen'];
async function step(ui) {
  const text = await ui.text('step');
  const found = STEPS.filter(name => text.includes(name));
  return found.length === 1 ? found[0] : text;
}
const MSG = {
  email: 'Introduce un correo válido',
  password: 'La contraseña debe tener al menos 8 caracteres y un dígito',
  name: 'El nombre es obligatorio',
  age: 'La edad debe ser un número entero entre 13 y 120',
  country: 'Selecciona un país',
  province: 'Selecciona una provincia',
  company: 'La empresa es obligatoria',
  freeDomain: 'El plan Equipo requiere un correo de empresa',
  localPart: 'La contraseña no puede contener el usuario del correo'
};
const hasAlert = async (ui, text) => (await ui.alerts()).some(a => a.includes(text));
async function account(ui, email, password) {
  await ui.fill('email', email);
  await ui.fill('password', password);
  await ui.click('next');
}
// Paso ACCOUNT de los casos: Cuenta válida (Correo = «ana@empresa.es», Contraseña = «clave123»); Siguiente.
const validAccount = ui => account(ui, 'ana@empresa.es', 'clave123');
// Rellena Perfil en el orden del caso (solo los campos indicados).
async function profile(ui, { name, age, country, province } = {}) {
  if (name !== undefined) await ui.fill('name', name);
  if (age !== undefined) await ui.fill('age', String(age));
  if (country !== undefined) await ui.select('country', country);
  if (province !== undefined) await ui.select('province', province);
}
const summary = ui => ui.text('summary');
const confirmation = ui => ui.textOrNull('confirmation');
const monthly = text => {
  const match = String(text ?? '').match(/Precio mensual\s*:?\s*(\d+\.\d{2})(?![\d.])/i);
  return match ? amount(match[1]) : null;
};

export const PLANS = {
  // ---------- R001 — paso Cuenta (V0) ----------
  'R001-A01': async (ui, c) => {
    c.eq('paso', await step(ui), 'Cuenta');
    c.eq('correo', await ui.value('email'), '');
    c.eq('contraseña', await ui.value('password'), '');
    c.eq('avisos', await ui.alerts(), []);
  },
  'R001-A02': async (ui, c) => {
    await account(ui, 'ana@empresa.es', 'clave123');
    c.eq('paso', await step(ui), 'Perfil');
    c.eq('avisos', await ui.alerts(), []);
  },
  'R001-A03': async (ui, c) => {
    await ui.fill('password', 'clave123');
    for (const email of ['ana.empresa.es', 'ana@empresa', 'ana@empresa.e']) {
      await ui.fill('email', email);
      await ui.click('next');
      c.eq(`paso con ${email}`, await step(ui), 'Cuenta');
      c.eq(`aviso de correo con ${email}`, await hasAlert(ui, MSG.email), true);
      c.eq(`sin aviso de contraseña con ${email}`, await hasAlert(ui, MSG.password), false);
    }
  },
  'R001-A04': async (ui, c) => {
    await ui.fill('email', 'ana@empresa.es');
    for (const password of ['abcdef1', 'abcdefgh']) {
      await ui.fill('password', password);
      await ui.click('next');
      c.eq(`paso con ${password}`, await step(ui), 'Cuenta');
      c.eq(`aviso con ${password}`, await hasAlert(ui, MSG.password), true);
    }
    await ui.fill('password', 'abcdefg1');
    await ui.click('next');
    c.eq('paso con abcdefg1', await step(ui), 'Perfil');
  },
  'R001-A05': async (ui, c) => {
    await account(ui, 'ana', 'abc');
    c.eq('aviso de correo', await hasAlert(ui, MSG.email), true);
    c.eq('aviso de contraseña', await hasAlert(ui, MSG.password), true);
    c.eq('paso', await step(ui), 'Cuenta');
    await ui.fill('email', 'ana@empresa.es');
    await ui.click('next');
    c.eq('sin aviso de correo', await hasAlert(ui, MSG.email), false);
    c.eq('aviso de contraseña tras corregir', await hasAlert(ui, MSG.password), true);
    c.eq('paso tras corregir', await step(ui), 'Cuenta');
  },

  // ---------- R002 — Perfil y Resumen (V0) ----------
  'R002-A01': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    c.eq('paso', await step(ui), 'Resumen');
    const text = await summary(ui);
    c.eq('correo', text.includes('ana@empresa.es'), true);
    c.eq('nombre', text.includes('Ana Pérez'), true);
    c.eq('edad', labeled(text, 'Edad'), 30);
    c.eq('país', text.includes('México'), true);
  },
  'R002-A02': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: '   ', age: 30, country: 'CL' });
    await ui.click('next');
    c.eq('paso', await step(ui), 'Perfil');
    c.eq('aviso', await hasAlert(ui, MSG.name), true);
  },
  'R002-A03': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Luis Gómez', country: 'FR' });
    for (const age of ['12', '121', '13.5']) {
      await ui.fill('age', age);
      await ui.click('next');
      c.eq(`paso con ${age}`, await step(ui), 'Perfil');
      c.eq(`aviso con ${age}`, await hasAlert(ui, MSG.age), true);
    }
    await ui.fill('age', '120');
    await ui.click('next');
    c.eq('paso con 120', await step(ui), 'Resumen');
    c.eq('edad en el resumen', labeled(await summary(ui), 'Edad'), 120);
  },
  'R002-A04': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Eva Ruiz', age: 13 });
    await ui.click('next');
    c.eq('paso sin país', await step(ui), 'Perfil');
    c.eq('aviso', await hasAlert(ui, MSG.country), true);
    await ui.select('country', 'PT');
    await ui.click('next');
    c.eq('paso con PT', await step(ui), 'Resumen');
    const text = await summary(ui);
    c.eq('país', text.includes('Portugal'), true);
    c.eq('edad', labeled(text, 'Edad'), 13);
  },
  'R002-A05': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Marta Gil', age: 45, country: 'CL' });
    await ui.click('next');
    await ui.click('back');
    c.eq('paso', await step(ui), 'Perfil');
    c.eq('nombre', await ui.value('name'), 'Marta Gil');
    c.eq('edad', await ui.value('age'), '45');
    c.eq('país', await ui.value('country'), 'CL');
    await ui.click('back');
    c.eq('paso', await step(ui), 'Cuenta');
    c.eq('correo', await ui.value('email'), 'ana@empresa.es');
    c.eq('contraseña', await ui.value('password'), 'clave123');
    await ui.click('next'); await ui.click('next');
    c.eq('paso', await step(ui), 'Resumen');
    const text = await summary(ui);
    c.eq('nombre', text.includes('Marta Gil'), true);
    c.eq('edad', labeled(text, 'Edad'), 45);
    c.eq('país', text.includes('Chile'), true);
  },
  'R002-A06': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    await ui.click('submit');
    const text = await confirmation(ui);
    c.eq('confirmación', text?.includes('Registro completado') && text.includes('ana@empresa.es'), true);
  },

  // ---------- R003 — provincia condicional (V1) ----------
  'R003-A01': async (ui, c, { regionOptions }) => {
    await validAccount(ui);
    await ui.select('country', 'ES');
    c.eq('opciones con ES', (await ui.options('province')).map(o => o.value), regionOptions('ES'));
    await ui.select('country', 'MX');
    c.eq('provincia con MX', await ui.exists('province'), false);
  },
  'R003-A02': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Pablo Díaz', age: 40, country: 'ES' });
    await ui.click('next');
    c.eq('paso', await step(ui), 'Perfil');
    c.eq('aviso', await hasAlert(ui, MSG.province), true);
  },
  'R003-A03': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Pablo Díaz', age: 40, country: 'ES', province: 'barcelona' });
    await ui.click('next');
    c.eq('paso', await step(ui), 'Resumen');
    const text = await summary(ui);
    c.eq('provincia', text.includes('Barcelona'), true);
    c.eq('país', text.includes('España'), true);
  },
  'R003-A04': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Pablo Díaz', age: 40, country: 'ES', province: 'sevilla' });
    await ui.select('country', 'MX');
    await ui.click('next');
    c.eq('paso', await step(ui), 'Resumen');
    const text = await summary(ui);
    c.eq('país', text.includes('México'), true);
    c.eq('sin Sevilla', text.includes('Sevilla'), false);
    c.eq('sin Provincia', text.includes('Provincia'), false);
  },
  'R003-A05': async (ui, c, { regionOptions }) => {
    await validAccount(ui);
    await profile(ui, { name: 'Pablo Díaz', age: 40, country: 'ES', province: 'valencia' });
    await ui.select('country', 'AR');
    c.eq('provincia vacía', await ui.value('province'), '');
    c.eq('opciones con AR', (await ui.options('province')).map(o => o.value), regionOptions('AR'));
    await ui.click('next');
    c.eq('paso sin provincia', await step(ui), 'Perfil');
    c.eq('aviso', await hasAlert(ui, MSG.province), true);
    await ui.select('province', 'cordoba');
    await ui.click('next');
    const text = await summary(ui);
    c.eq('provincia', text.includes('Córdoba'), true);
    c.eq('país', text.includes('Argentina'), true);
  },
  'R003-A06': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Pablo Díaz', age: 40, country: 'ES', province: 'madrid' });
    await ui.click('next');
    await ui.click('back');
    c.eq('paso', await step(ui), 'Perfil');
    c.eq('provincia', await ui.value('province'), 'madrid');
  },

  // ---------- R004 — plan (V2) ----------
  'R004-A01': async (ui, c, { price }) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    c.eq('Básico marcado', await ui.checked('basic'), true);
    c.eq('Pro sin marcar', await ui.checked('pro'), false);
    c.eq('Equipo sin marcar', await ui.checked('team'), false);
    c.eq('Pro habilitado', await ui.enabled('pro'), true);
    c.eq('Equipo habilitado', await ui.enabled('team'), true);
    const text = await summary(ui);
    c.eq('plan', text.includes('Plan: Básico'), true);
    c.eq('precio', monthly(text), price('basico'));
  },
  'R004-A02': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 17, country: 'MX' });
    await ui.click('next');
    c.eq('Pro con 17', await ui.enabled('pro'), false);
    c.eq('Básico con 17', await ui.checked('basic'), true);
    await ui.click('back');
    await ui.fill('age', '18');
    await ui.click('next');
    c.eq('Pro con 18', await ui.enabled('pro'), true);
  },
  'R004-A03': async (ui, c, { price }) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    await ui.check('pro');
    const text = await summary(ui);
    c.eq('plan', text.includes('Plan: Pro'), true);
    c.eq('precio', monthly(text), price('pro'));
    await ui.click('submit');
    c.eq('confirmación', (await confirmation(ui))?.includes('ana@empresa.es') ?? false, true);
  },
  'R004-A04': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    await ui.check('team');
    await ui.fill('company', '   ');
    await ui.click('submit');
    c.eq('aviso', await hasAlert(ui, MSG.company), true);
    c.eq('sin confirmación', await confirmation(ui), null);
    await ui.fill('company', 'Talleres Norte');
    await ui.click('submit');
    c.eq('confirmación', (await confirmation(ui))?.includes('ana@empresa.es') ?? false, true);
  },
  'R004-A05': async (ui, c, { price }) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    await ui.check('team');
    await ui.fill('company', 'Talleres Norte');
    c.eq('Empresa visible', await ui.exists('company'), true);
    let text = await summary(ui);
    c.eq('plan Equipo', text.includes('Plan: Equipo'), true);
    c.eq('precio Equipo', monthly(text), price('equipo'));
    c.eq('empresa', text.includes('Talleres Norte'), true);
    await ui.check('basic');
    c.eq('Empresa oculta', await ui.exists('company'), false);
    text = await summary(ui);
    c.eq('plan Básico', text.includes('Plan: Básico'), true);
    c.eq('precio Básico', monthly(text), price('basico'));
    c.eq('sin empresa', text.includes('Talleres Norte'), false);
  },
  'R004-A06': async (ui, c) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 30, country: 'MX' });
    await ui.click('next');
    await ui.check('pro');
    await ui.click('back'); await ui.click('next');
    c.eq('Pro marcado', await ui.checked('pro'), true);
    c.eq('plan', (await summary(ui)).includes('Plan: Pro'), true);
  },

  // ---------- R005 — reglas cruzadas (V3) ----------
  'R005-A01': async (ui, c) => {
    await account(ui, 'rosa@gmail.com', 'clave123');
    await profile(ui, { name: 'Rosa Vidal', age: 35, country: 'MX' });
    await ui.click('next');
    await ui.check('team');
    await ui.fill('company', 'Estudio Rosa');
    await ui.click('submit');
    c.eq('aviso', await hasAlert(ui, MSG.freeDomain), true);
    c.eq('sin confirmación', await confirmation(ui), null);
    c.eq('paso', await step(ui), 'Resumen');
  },
  'R005-A02': async (ui, c) => {
    await account(ui, 'rosa@estudiorosa.es', 'clave123');
    await profile(ui, { name: 'Rosa Vidal', age: 35, country: 'MX' });
    await ui.click('next');
    await ui.check('team');
    await ui.fill('company', 'Estudio Rosa');
    await ui.click('submit');
    const text = await confirmation(ui);
    c.eq('correo', text?.includes('rosa@estudiorosa.es') ?? false, true);
    c.eq('plan', text?.includes('Plan: Equipo') ?? false, true);
  },
  'R005-A03': async (ui, c) => {
    await account(ui, 'rosa@GMAIL.com', 'clave123');
    await profile(ui, { name: 'Rosa Vidal', age: 35, country: 'MX' });
    await ui.click('next');
    await ui.check('team');
    await ui.fill('company', 'Estudio Rosa');
    await ui.click('submit');
    c.eq('aviso', await hasAlert(ui, MSG.freeDomain), true);
    c.eq('sin confirmación', await confirmation(ui), null);
    await ui.check('basic');
    await ui.click('submit');
    const text = await confirmation(ui);
    c.eq('correo', text?.includes('rosa@GMAIL.com') ?? false, true);
    c.eq('plan', text?.includes('Plan: Básico') ?? false, true);
  },
  'R005-A04': async (ui, c, { price }) => {
    await validAccount(ui);
    await profile(ui, { name: 'Ana Pérez', age: 25, country: 'FR' });
    await ui.click('next');
    await ui.check('pro');
    await ui.click('back');
    await ui.fill('age', '16');
    await ui.click('next');
    c.eq('Básico marcado', await ui.checked('basic'), true);
    c.eq('Pro sin marcar', await ui.checked('pro'), false);
    c.eq('Pro deshabilitado', await ui.enabled('pro'), false);
    const text = await summary(ui);
    c.eq('plan', text.includes('Plan: Básico'), true);
    c.eq('precio', monthly(text), price('basico'));
  },
  'R005-A05': async (ui, c) => {
    await account(ui, 'marta.gil@empresa.es', 'Marta.Gil2024');
    c.eq('paso', await step(ui), 'Cuenta');
    c.eq('aviso', await hasAlert(ui, MSG.localPart), true);
    await ui.fill('password', 'clave2024');
    await ui.click('next');
    c.eq('paso tras corregir', await step(ui), 'Perfil');
  },
  'R005-A06': async (ui, c) => {
    await account(ui, 'rosa@gmail.com', 'clave123');
    await profile(ui, { name: 'Rosa Vidal', age: 35, country: 'MX' });
    await ui.click('next');
    await ui.check('pro');
    await ui.click('submit');
    const text = await confirmation(ui);
    c.eq('correo', text?.includes('rosa@gmail.com') ?? false, true);
    c.eq('plan', text?.includes('Plan: Pro') ?? false, true);
  }
};
