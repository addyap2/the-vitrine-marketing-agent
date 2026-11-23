import {agents,brandContext,AgentId} from './agents';

/** Pure local prompt construction. No user data is transmitted by the app. */
export function buildClaudePrompt(id:AgentId, request:string):string {
 const agent=agents.find(a=>a.id===id);
 if(!agent) throw new Error('Agent inconnu');
 const special:Record<AgentId,string>={
 strategy:'Structure : diagnostic, objectif, cible, proposition, plan de 30 jours, indicateurs, risques.',
 social:'Fournis 3 accroches, la publication finale, un CTA, des hashtags sobres, un brief visuel et une variante Facebook. Pour un carrousel, sépare chaque slide.',
 creative:'Donne des prompts visuels prêts à copier et, si vidéo, un storyboard de 8 secondes au format vertical 9:16. Indique précisément ce qui ne doit pas apparaître.',
 calendar:'Présente un tableau avec date indicative, plateforme, format, thème, objectif, CTA et statut brouillon. Ne prétends pas publier.',
 seo:'Sépare les recommandations vérifiables des hypothèses. Fournis titres SEO, méta descriptions, H1/H2, FAQ, SEO local et priorités GEO.',
 analytics:'Ne calcule que sur des données réellement fournies. Donne les formules, limites de l’échantillon, enseignements et prochaines expériences.'
 };
 return [`RÔLE : ${agent.name.toUpperCase()}`,agent.prompt,'','CONTEXTE DE MARQUE',brandContext,'','DEMANDE',request.trim(),'','CONSIGNES DE LIVRAISON',special[id],'Réponds en français de France, avec un ton professionnel, humain et clair. Évite les clichés publicitaires et les résultats inventés. Distingue les faits, hypothèses et suggestions. Termine par une liste de contrôle avant publication.'].join('\n');
}