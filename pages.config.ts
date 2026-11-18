export default {
 source: 'templates', out:'site', assets:'assets/pages', copySource:false,
 copy:[{from:'styles',to:'styles'},{from:'version.json',to:'version.json'}],
 pages:[
  {from:'index.html',route:'/'},
  {from:'studio.html',route:'/studio/'},
  {from:'about.html',route:'/about/'},
  {from:'404.html',route:'/404.html'}
 ],
 css:{files:['kofi.css','markdown.css']},
 runtime:{
  base:'/web-animation-studio/',
  kofi:{user:'kittycrow',header:'.site-header',footer:'.footer__links',footerText:'Buy me a coffee',separator:' · ',desktopText:'Buy me a coffee?',background:'#5bc0de',text:'#323842',wideAt:721},
  version:{file:'version.json',selector:'[data-version]',prefix:'v',fallback:'v?'},
  readme:{owner:'kitty-crow',repo:'web-animation-studio',branch:'main',path:'docs/index.md',content:'#readme-content',status:'#readme-status'}
 }
};
