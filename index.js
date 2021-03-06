/*
   toc data format
   array of { d:depth, o:opened, t:text, n:next_same_level ]

   only first level can be 0

   TODO, do not write directly to props.toc
*/
var React=require("react");
var TreeNode=require("./treenode");
var E=React.createElement;
var manipulate=require("./manipulate");
var PT=React.PropTypes;
var util=require("./util");
var buildToc = function(toc) {
	if (!toc || !toc.length || toc.built) return;
	var depths=[];
 	var prev=0;
 	if (toc.length>1) {
 		toc[0].o=true;//opened
 	}
 	for (var i=0;i<toc.length;i++) delete toc[i].n;
	for (var i=0;i<toc.length;i++) {
	    var depth=toc[i].d||toc[i].depth;
	    if (prev>depth) { //link to prev sibling
	      if (depths[depth]) toc[depths[depth]].n = i;
	      for (var j=depth;j<prev;j++) depths[j]=0;
	    }
    	depths[depth]=i;
    	prev=depth;
	}
	toc.built=true;
	return toc;
}
var genToc=function(toc,title) {
    var out=[{d:0,t:title||ksana.js.title}];
    if (toc.texts) for (var i=0;i<toc.texts.length;i++) {
      out.push({t:toc.texts[i],d:toc.depths[i], vpos:toc.vpos[i]});
    }
    return out;
}

var TreeToc=React.createClass({
	propTypes:{
		toc:PT.array.isRequired  //core toc dataset
		,opts:PT.object    
		,onSelect:PT.func  //user select a treenode
		,tocid:PT.string  //toc view 
		,styles:PT.object //custom styles
		,conv:PT.func //custom converter for each item
		,scrollTo:PT.number
		,onScrollTop:PT.func //callback for scrollTo
	}
	,getInitialState:function(){
		return {editcaption:-1,selected:[],scrollTo:this.props.scrollTo};
	}
	,clearHits:function() {
		for (var i=0;i<this.props.toc.length;i++) {
			if (this.props.toc[i].hit) delete this.props.toc[i].hit;
		}
	}
	,componentDidMount:function() {
		buildToc(this.props.toc);
		this.openAncestor();
	}
	,componentDidUpdate:function(){
		if (this.scrollingTo) {
			var n=document.querySelector('[data-n="'+this.scrollingTo+'"');
			if (n&&this.props.onScrollTop) {
				this.props.onScrollTop(n.getBoundingClientRect().top);
			}
		}
	}
	,openAncestor:function(toc,scrollTo){
		toc=toc||this.props.toc;
		scrollTo=scrollTo||this.props.scrollTo;

		if (scrollTo==-1) return;
		var ans=util.enumAncestors(toc,scrollTo);
		ans.forEach(function(a){
			toc[a].o=true;
		});
		this.scrollingTo=scrollTo;
	}
	,componentWillReceiveProps:function(nextProps) {
		if (nextProps.toc && !nextProps.toc.built) {
			buildToc(nextProps.toc);
		}
		if (nextProps.hits!==this.props.hits) {
			this.clearHits();
		}
		this.openAncestor(nextProps.toc,nextProps.scrollTo);
		if (nextProps.scrollTo>-1) {
			this.setState({selected:[nextProps.scrollTo]});
		}
		this.action("updateall");
	}
	,getDefaultProps:function() {
		return {opts:{}};
	}
	,markDirty:function() {
		this.props.onChanged&&this.props.onChanged();
	}
	,action:function() {
		var args=Array.prototype.slice.apply(arguments);
		var act=args.shift();
		var p1=args[0];
		var p2=args[1];
		var sels=this.state.selected;
		var toc=this.props.toc;
		var r=false;
		if (act==="updateall") {
			this.setState({editcaption:-1,deleting:-1});
		} else if (act==="editcaption") {
			var n=parseInt(p1);
			this.setState({editcaption:n,selected:[n]});
		} else if (act==="deleting") {
			this.setState({deleting:this.state.editcaption});
		} else if (act==="changecaption") {
			if (!this.state.editcaption===-1) return;
			if (!p1) {
				this.action("deleting");
			} else {
				this.props.toc[this.state.editcaption].t=p1;
				this.setState({editcaption:-1});
				this.markDirty();
			}
		} else if (act==="select") {
			var selected=this.state.selected;
			if (!(this.props.opts.multiselect && p2)) {
				selected=[];
			}
			var n=parseInt(p1);
			if (!isNaN(n)) {
				selected.push(n);
				this.props.onSelect&&this.props.onSelect(this.props.tocid,this.props.toc[n],n,this.props.toc);
			}
			this.setState({selected:selected,editcaption:-1,deleting:-1,adding:0});
		} else if (act==="addingnode") {
			var insertAt=sels[0];
			if (p1) {
				insertAt=-insertAt; //ctrl pressed insert before
			}
			this.setState({adding:insertAt,editcaption:-1});
		} else if (act=="addnode") {
			var n=this.state.selected[0];
			r=manipulate.addNode(toc,n,p1,p2)
		}else if (act==="levelup") r=manipulate.levelUp(sels,toc);
		else if (act==="leveldown") r=manipulate.levelDown(sels,toc);
		else if (act==="deletenode") r=manipulate.deleteNode(sels,toc);
		else if (act==="hitclick") {
			this.props.onHitClick&&this.props.onHitClick(this.props.tocid,this.props.toc[p1],p1,this.props.toc);
		}
		if (r) {
			toc.built=false;//force rebuild
			buildToc(toc);
			this.setState({editcaption:-1,deleting:-1,adding:0});
			if (act==="deletenode") this.setState({selected:[]});
			this.markDirty();
		}
	}
	,render:function() {
		return E("div",{},
			E(TreeNode,{ref:"tree",toc:this.props.toc,
				editcaption:this.state.editcaption,
				deleting:this.state.deleting,
				selected:this.state.selected,
				treename:this.props.treename,
				styles:this.props.styles,
				adding:this.state.adding,
				opened:this.props.opened,
				closed:this.props.closed,
				captionClass:this.props.captionClass,
				nodeicons:this.props.nodeicons,
				action:this.action,opts:this.props.opts,cur:0,
				hits:this.props.hits,
				conv:this.props.conv
			}));
	}
})
module.exports={Component:TreeToc,genToc:genToc,buildToc:buildToc};
