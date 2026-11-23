/** Strict validation of untrusted browser backups. No third-party dependency. */
export type BackupDraft = { id:string; title:string; agent:string; content:string; status:'Brouillon'|'Approuvé'|'Publié'; date:string; created:string; channel?:string; campaign?:string };
export type BackupCampaign = { id:string; name:string; objective:string; audience:string; status:'Idée'|'Active'|'Terminée' };
const object = (v:unknown):v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v);
const str = (v:unknown,max:number):v is string => typeof v==='string' && v.length<=max;
const date = (v:unknown) => {
 if(!str(v,10))return false;
 if(v==='')return true;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const [year,month,day]=v.split('-').map(Number);
 const parsed=new Date(Date.UTC(year,month-1,day));
 return parsed.getUTCFullYear()===year && parsed.getUTCMonth()===month-1 && parsed.getUTCDate()===day;
};
const draft = (v:unknown):v is BackupDraft => object(v) && str(v.id,100) && !!v.id && str(v.title,500) && str(v.agent,100) && str(v.content,100000) && ['Brouillon','Approuvé','Publié'].includes(String(v.status)) && date(v.date) && str(v.created,100) && (v.channel===undefined || str(v.channel,100)) && (v.campaign===undefined || str(v.campaign,100));
const campaign = (v:unknown):v is BackupCampaign => object(v) && str(v.id,100) && !!v.id && str(v.name,500) && str(v.objective,2000) && str(v.audience,2000) && ['Idée','Active','Terminée'].includes(String(v.status));
export function parseBackup(json:string):{drafts:BackupDraft[];campaigns:BackupCampaign[]} {
 if(json.length>5_000_000)throw Error('Sauvegarde trop volumineuse');
 let data:unknown;try{data=JSON.parse(json)}catch{throw Error('JSON invalide')}
 if(!object(data) || data.version!==2 || !Array.isArray(data.drafts) || !Array.isArray(data.campaigns))throw Error('Version ou structure incompatible');
 if(data.drafts.length>10000 || data.campaigns.length>1000 || !data.drafts.every(draft) || !data.campaigns.every(campaign))throw Error('Données incorrectes');
 if(new Set(data.drafts.map(d=>d.id)).size!==data.drafts.length || new Set(data.campaigns.map(c=>c.id)).size!==data.campaigns.length)throw Error('Identifiants en double');
 const campaignIds=new Set(data.campaigns.map(c=>c.id));
 if(data.drafts.some(d=>d.campaign && !campaignIds.has(d.campaign)))throw Error('Campagne référencée introuvable');
 return {drafts:data.drafts,campaigns:data.campaigns};
}
export function makeBackup(drafts:BackupDraft[],campaigns:BackupCampaign[]){return {version:2,exportedAt:new Date().toISOString(),drafts,campaigns}}