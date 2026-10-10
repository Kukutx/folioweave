// Generated slot entry; imports only plugins for this slot.
import 'server-only';
import type { PluginContext } from '@/core/contracts';
import { PluginBoundary } from '@/core/plugin-boundary';
import Plugin0 from "@/plugins/music/player";
export default function PluginSlot({ context }: { context: PluginContext }) {
  return <><PluginBoundary key={"music" + ":" + (context.article?.id ?? "site")} name={"Music player"}><Plugin0 options={{"label":"Listening","skin":"capsule","position":"right","theme":"graphite","initialExpanded":false,"autoplay":true,"volume":0.7,"tracks":[{"id":"time-is-broken","title":"Time Is Broken","artist":"Phonk","src":"/portfolio/audio/time-is-broken.mp3"},{"id":"gymnopedie-1","title":"Gymnopédie No. 1","artist":"Erik Satie · Robin Alciatore, piano","src":"https://upload.wikimedia.org/wikipedia/commons/transcoded/9/90/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg.mp3"},{"id":"clair-de-lune","title":"Clair de lune","artist":"Claude Debussy","src":"https://upload.wikimedia.org/wikipedia/commons/transcoded/b/be/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg.mp3"},{"id":"nocturne-op9-2","title":"Nocturne Op. 9 No. 2","artist":"Frédéric Chopin","src":"https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5c/Frederic_Chopin_-_Nocturne_Eb_major_Opus_9%2C_number_2.ogg/Frederic_Chopin_-_Nocturne_Eb_major_Opus_9%2C_number_2.ogg.mp3"}]}} context={context} /></PluginBoundary></>;
}
