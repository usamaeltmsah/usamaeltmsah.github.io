// Loaded by the inline loader in index.astro only when the Experience section comes near,
// so neither this file nor Three.js is part of the initial page load.
import type { Timeline } from '../../lib/timeline';
import { mount } from './stack';

const section = document.querySelector<HTMLElement>('#experience');
const phones = section?.querySelector<HTMLElement>('.phones');
const json = document.getElementById('phone-data')?.textContent;

const fallBack = (err: unknown) => {
  section?.classList.remove('has-phones');
  console.error('[phone-stack] showing the plain timeline instead:', err);
};

if (!section || !phones || !json) fallBack(new Error('phone stack markup or data is missing'));
else {
  try {
    await mount(phones, JSON.parse(json) as Timeline);
  } catch (err) {
    fallBack(err);
  }
}
