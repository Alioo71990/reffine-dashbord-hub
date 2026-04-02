export const COUNTRY_FLAGS: Record<string, string> = {
  'UAE': 'ae','Saudi Arabia': 'sa','Qatar': 'qa','Oman': 'om',
  'Bahrain': 'bh','Kuwait': 'kw','Jordan': 'jo','Egypt': 'eg',
  'Palestine': 'ps','Iraq': 'iq','Morocco': 'ma','Lebanon': 'lb',
  'Tunisia': 'tn','Algeria': 'dz','Azerbaijan': 'az','Georgia': 'ge',
  'Kazakhstan': 'kz','Armenia': 'am'
}

export const REGION_GROUPS = [
  { title: 'GCC', countries: ['UAE','Saudi Arabia','Qatar','Oman','Bahrain','Kuwait'] },
  { title: 'XM', countries: ['Jordan','Egypt','Palestine','Iraq','Morocco','Lebanon','Tunisia','Algeria'] },
  { title: 'LANGS', countries: ['Azerbaijan','Georgia','Kazakhstan','Armenia'] }
]

export const SITE_DATA: Record<string, Record<string, Record<string, string>>> = {
  LRDX: {
    'UAE': { EN:'https://www.landrover-uae.com/en/', AR:'https://www.landrover-uae.com/ar/' },
    'Saudi Arabia': { EN:'https://www.landrover-saudi.com/en/', AR:'https://www.landrover-saudi.com/ar/' },
    'Qatar': { EN:'https://www.landrover-qatar.com/en/', AR:'https://www.landrover-qatar.com/ar/' },
    'Oman': { EN:'https://www.landrover-oman.com/en/', AR:'https://www.landrover-oman.com/ar/' },
    'Bahrain': { EN:'https://www.landroverbahrain.com/en/', AR:'https://www.landroverbahrain.com/ar/' },
    'Kuwait': { EN:'https://www.landroverkuwait.com/en/', AR:'https://www.landroverkuwait.com/ar/' },
    'Jordan': { EN:'https://www.landrover-jordan.com/en/', AR:'https://www.landrover-jordan.com/ar/' },
    'Egypt': { EN:'https://www.landrover-egypt.com/en/', AR:'https://www.landrover-egypt.com/ar/' },
    'Palestine': { EN:'https://www.landrover-palestine.com/en/', AR:'https://www.landrover-palestine.com/ar/' },
    'Iraq': { EN:'https://www.landrover-iraq.com/en/', AR:'https://www.landrover-iraq.com/ar/', KU:'https://www.landrover-iraq.com/ku/' },
    'Morocco': { EN:'https://www.landrover-maroc.com/en/', AR:'https://www.landrover-maroc.com/ar/', FR:'https://www.landrover-maroc.com/fr/' },
    'Lebanon': { EN:'https://www.landrover-lebanon.com/en/', AR:'https://www.landrover-lebanon.com/ar/', FR:'https://www.landrover-lebanon.com/fr/' },
    'Tunisia': { EN:'https://www.landrover-tunisie.com/en/', AR:'https://www.landrover-tunisie.com/ar/', FR:'https://www.landrover-tunisie.com/fr/' },
    'Algeria': { EN:'https://www.landrover-algerie.com/en/', AR:'https://www.landrover-algerie.com/ar/', FR:'https://www.landrover-algerie.com/fr/' },
    'Azerbaijan': { EN:'https://www.landrover-azerbaijan.com/en/', AZ:'https://www.landrover-azerbaijan.com/az/' },
    'Georgia': { EN:'https://www.landrover-georgia.com/en/', GE:'https://www.landrover-georgia.com/ge/' },
    'Kazakhstan': { EN:'https://www.landrover-kazakhstan.com/en/', KZ:'https://www.landrover-kazakhstan.com/kz/', RU:'https://www.landrover-kazakhstan.com/ru/' },
    'Armenia': { EN:'https://www.landrover-armenia.com/en/', AM:'https://www.landrover-armenia.com/am/', RU:'https://www.landrover-armenia.com/ru/' }
  },
  RR: {
    'UAE': { EN:'https://www.rangerover.com/en-ae/', AR:'https://www.rangerover.com/ar-ae/' },
    'Saudi Arabia': { EN:'https://www.rangerover.com/en-sa/', AR:'https://www.rangerover.com/ar-sa/' },
    'Qatar': { EN:'https://www.rangerover.com/en-qa/', AR:'https://www.rangerover.com/ar-qa/' },
    'Oman': { EN:'https://www.rangerover.com/en-om/', AR:'https://www.rangerover.com/ar-om/' },
    'Bahrain': { EN:'https://www.rangerover.com/en-bh/', AR:'https://www.rangerover.com/ar-bh/' },
    'Kuwait': { EN:'https://www.rangerover.com/en-kw/', AR:'https://www.rangerover.com/ar-kw/' },
    'Jordan': { EN:'https://www.rangerover.com/en-jo/', AR:'https://www.rangerover.com/ar-jo/' },
    'Egypt': { EN:'https://www.rangerover.com/en-eg/', AR:'https://www.rangerover.com/ar-eg/' },
    'Palestine': { EN:'https://www.rangerover.com/en-ps/', AR:'https://www.rangerover.com/ar-ps/' },
    'Iraq': { EN:'https://www.rangerover.com/en-iq/', AR:'https://www.rangerover.com/ar-iq/', KU:'https://www.rangerover.com/ku-iq/' },
    'Morocco': { EN:'https://www.rangerover.com/en-ma/', AR:'https://www.rangerover.com/ar-ma/', FR:'https://www.rangerover.com/fr-ma/' },
    'Lebanon': { EN:'https://www.rangerover.com/en-lb/', AR:'https://www.rangerover.com/ar-lb/', FR:'https://www.rangerover.com/fr-lb/' },
    'Tunisia': { EN:'https://www.rangerover.com/en-tn/', AR:'https://www.rangerover.com/ar-tn/', FR:'https://www.rangerover.com/fr-tn/' },
    'Algeria': { EN:'https://www.rangerover.com/en-dz/', AR:'https://www.rangerover.com/ar-dz/', FR:'https://www.rangerover.com/fr-dz/' },
    'Azerbaijan': { EN:'https://www.rangerover.com/en-az/', AZ:'https://www.rangerover.com/az-az/' },
    'Georgia': { EN:'https://www.rangerover.com/en-ge/', GE:'https://www.rangerover.com/ge-ge/' },
    'Kazakhstan': { EN:'https://www.rangerover.com/en-kz/', KZ:'https://www.rangerover.com/kz-kz/', RU:'https://www.rangerover.com/ru-kz/' },
    'Armenia': { EN:'https://www.rangerover.com/en-am/', AM:'https://www.rangerover.com/am-am/', RU:'https://www.rangerover.com/ru-am/' }
  },
  JDX: {
    'UAE': { EN:'https://www.jaguar-uae.com/en/', AR:'https://www.jaguar-uae.com/ar/' },
    'Saudi Arabia': { EN:'https://www.jaguar-saudi.com/en/', AR:'https://www.jaguar-saudi.com/ar/' },
    'Qatar': { EN:'https://www.jaguar-qatar.com/en/', AR:'https://www.jaguar-qatar.com/ar/' },
    'Oman': { EN:'https://www.jaguar-oman.com/en/', AR:'https://www.jaguar-oman.com/ar/' },
    'Bahrain': { EN:'https://www.jaguar-bahrain.com/en/', AR:'https://www.jaguar-bahrain.com/ar/' },
    'Kuwait': { EN:'https://www.jaguar-kuwait.com/en/', AR:'https://www.jaguar-kuwait.com/ar/' },
    'Jordan': { EN:'https://www.jaguar-jordan.com/en/', AR:'https://www.jaguar-jordan.com/ar/' },
    'Egypt': { EN:'https://www.jaguar-egypt.com/en/', AR:'https://www.jaguar-egypt.com/ar/' },
    'Palestine': { EN:'https://www.jaguar-palestine.com/en/', AR:'https://www.jaguar-palestine.com/ar/' },
    'Iraq': { EN:'https://www.jaguar-iraq.com/en/', AR:'https://www.jaguar-iraq.com/ar/', KU:'https://www.jaguar-iraq.com/ku/' },
    'Morocco': { EN:'https://www.jaguar-maroc.com/en/', AR:'https://www.jaguar-maroc.com/ar/', FR:'https://www.jaguar-maroc.com/fr/' },
    'Lebanon': { EN:'https://www.jaguar-lebanon.com/en/', AR:'https://www.jaguar-lebanon.com/ar/', FR:'https://www.jaguar-lebanon.com/fr/' },
    'Tunisia': { EN:'https://www.jaguar-tunisie.com/en/', AR:'https://www.jaguar-tunisie.com/ar/', FR:'https://www.jaguar-tunisie.com/fr/' },
    'Algeria': { EN:'https://www.jaguar-algerie.com/en/', AR:'https://www.jaguar-algerie.com/ar/', FR:'https://www.jaguar-algerie.com/fr/' },
    'Azerbaijan': { EN:'https://www.jaguar-azerbaijan.com/en/', AZ:'https://www.jaguar-azerbaijan.com/az/' },
    'Georgia': { EN:'https://www.jaguar-georgia.com/en/', GE:'https://www.jaguar-georgia.com/ge/' },
    'Kazakhstan': { EN:'https://www.jaguar-kazakhstan.com/en/', KZ:'https://www.jaguar-kazakhstan.com/kz/', RU:'https://www.jaguar-kazakhstan.com/ru/' },
    'Armenia': { EN:'https://www.jaguar-armenia.com/en/', AM:'https://www.jaguar-armenia.com/am/', RU:'https://www.jaguar-armenia.com/ru/' }
  }
}

export const RR_CMS_PREFIXES: Record<string, string> = {
  'UAE':'uae','Saudi Arabia':'ksa','Qatar':'qatar','Oman':'oman','Bahrain':'bahrain','Kuwait':'kuwait',
  'Jordan':'jordan','Egypt':'egypt','Palestine':'palestine','Iraq':'iraq','Morocco':'morocco',
  'Lebanon':'lebanon','Tunisia':'tunisia','Algeria':'algeria','Azerbaijan':'azerbaijan',
  'Georgia':'georgia','Kazakhstan':'kazakhstan','Armenia':'armenia'
}

export const IMPORTANT_SITES = [
  { name:'MENA Folder Drive', url:'https://drive.google.com/drive/u/1/folders/1n3INQqjnYjaqSpEzXHRHdWgbWv9yoPtw' },
  { name:'Offers Login', url:'https://offers.mena.jlr.reffine.com/admin/login' },
  { name:'CDN Image Library', url:'https://media.raffine.eu/admin/login' },
  { name:'Offer Status Sheet', url:'https://docs.google.com/spreadsheets/d/1TVBv1CpH5_uHAKyQPbz_yH4GAwlyR2JdJjdEgmTmZJo/edit#gid=275235307' },
  { name:'URL Structure for Offers MENA', url:'https://docs.google.com/document/d/1lh_Wh5x2smZshH39TpFtWBGTXBKOZ617sNWjBTh1Fmo/edit?tab=t.0' },
  { name:'MENA Content Team Tasks', url:'https://docs.google.com/spreadsheets/d/1ZHvECROiUXjvBVZ_A-Xs0PTQTWTb3QJZPRvjUHTnRfE/edit?gid=401688263#gid=401688263' },
  { name:'RWS Nameplate Updates', url:'https://sftpscan.rws.com/#/jlr-marketing-scanned/Accenture/DX/Nameplates/' },
  { name:'RWS Non-Nameplate Updates', url:'https://sftpscan.rws.com/#/jlr-marketing-scanned/Accenture/DX/Non-Nameplates/' },
  { name:'MENA Translations Database', url:'https://drive.google.com/drive/u/1/folders/1Zvkx6u9hQWu-Weu5jYSOFbWEqbaQ1M_v' }
]

export const CC_REFFINE = [
  { name:'Mouad Jaafari', email:'mjaafari@jaguarlandrover.com' },
  { name:'Ali Al-Kazaz', email:'ali.alkazaz@reffine.com' },
  { name:'Piotr Karaś', email:'piotr.karas@reffine.com' },
  { name:'Patryk Szafiański', email:'patryk.szafianski@reffine.com' },
  { name:'Bartosz Trzmielewski', email:'bartosz.trzmielewski@reffine.com' },
  { name:'Maciej Stachura', email:'maciej.stachura@reffine.com' },
  { name:'Kacper Grudziński', email:'kacper.grudzinski@reffine.com' },
  { name:'Marcin Bekasiewicz', email:'marcin.bekasiewicz@reffine.com' }
]

export const EMAIL_GROUPS = [
  { id:'az', title:'Email Title — AZ', greeting:'Hi Team,',
    to:[{name:'"Elnur A. Guliyev"',email:'e.guliyev@autolux-az.com'},{name:'"Mujgan M. Aliyeva"',email:'m.aliyeva@autolux-az.com'},{name:'"Samira F. Gadirova"',email:'s.gadirova@autolux-az.com'}], cc:CC_REFFINE },
  { id:'ge', title:'Email Title — GE', greeting:'Hi Team,',
    to:[{name:'Ella Kamladze',email:'E.Kamladze@gtmotors.ge'},{name:'Mata Ustiashvili',email:'m.ustiashvili@gtmotors.ge'}], cc:CC_REFFINE },
  { id:'ku', title:'Email Title — KU', greeting:'Hi Rabin,',
    to:[{name:'Rabin Majid Salih',email:'rabin.majid@sta.iq'}], cc:CC_REFFINE },
  { id:'kzru', title:'Email Title — KZ/RU', greeting:'Hi Aruzhan,',
    to:[{name:'Aruzhan Nurgabylova',email:'a.nurgabylova@britishmotors.kz'}], cc:CC_REFFINE },
  { id:'am', title:'Email Title — AM', greeting:'Hi Mane,',
    to:[{name:'Mane Sargsyan',email:'mane.sargsyan@autogroup.am'}], cc:CC_REFFINE }
]

// Allowed email domains for login
export const ALLOWED_EMAIL_DOMAINS = ['reffine.com', 'jaguarlandrover.com']
export const ALLOWED_EMAILS_EXACT: string[] = [] // add specific emails if needed
