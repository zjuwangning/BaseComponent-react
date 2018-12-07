/**
 * Created by dell on 2017/2/5.
 */
import React from 'react';
import moment from 'moment';
import '../components/functionWidget/pubsub';
import {isEmpty,isEqual,cpy,getVal} from '../util/cmn';
import Cache from './Cache';
import 'jquery';
import '../plugIn/jquery-migrate-1.2.1.min'
import '../plugIn/jquery.jqprint-0.3'

class BaseComponent extends React.Component{
    constructor(props){
        super(props);

        this.hasUnsaved = this.hasUnsaved.bind(this);
        this.setInitData = this.setInitData.bind(this);
        this.updataInitData = this.updataInitData.bind(this);

        //表格的获取变更数据函数
        this.getDiffData = this.getDiffData.bind(this);
        this.isDiffEmpty = this.isDiffEmpty.bind(this);
        this.getAddData = this.getAddData.bind(this);
        this.getDelData = this.getDelData.bind(this);
        this.getUpdateData = this.getUpdateData.bind(this);

        //visible的设定部分
        this.setVisible = this.setVisible.bind(this);
        this.setDisVisible = this.setDisVisible.bind(this);
        this.getVisible = this.getVisible.bind(this);

        this.initData = {};
    }

    componentDidMount(){
        this.hasUnsaved_pubtoken = PubSub.subscribe('hasUnsaved', this.hasUnsaved);
    }

    componentWillUnmount(){
        PubSub.unsubscribe(this.hasUnsaved_pubtoken);
    }

    componentDidUpdate(preProps){
        if(!isEmpty(this.props.trigger_func)){
            for(let key in this.props.trigger_func){
                if(this.props.trigger_func[key] && (!preProps.trigger_func || !preProps.trigger_func[key])){
                    this[key](...this.props.trigger_func[key]);
                }
            }
        }
    }

    //设定某一数据的初始数据
    setInitData(key, data){
        this.initData[key] = cpy(data);
        let param = {};
        param[key] = data;
        this.setState(param);
    }

    //同步初始数据和界面数据
    updataInitData(key){
        this.initData[key] = this.state[key];
    }

    //判断是否有未保存数据
    hasUnsaved() {
        if(!isEmpty(this.state) && !isEmpty(this.state.cannot_leave)){
            Cache.set("hasUnsaved_pubsubData", this.state.cannot_leave);
            return;
        }
        for (let key in this.initData) {
            if (!isEqual(this.initData[key], this.state[key])){
                Cache.set("hasUnsaved_pubsubData", "未保存页面数据");
                return;
            }
        }
    }

    /**
     * 寻找不同的数据, 这里是表格操作部分
     * id是表格每行数据的唯一标识, 由服务端生成
     * 1. 新增数据
     * 2. 修改数据
     * 3. 删除数据
     */
    getDiffData(key, id = "id"){
        let init = this.initData[key];
        let data = this.state[key];
        return {
            add     : this.getAddData(data, id),
            del     : this.getDelData(init, data, id),
            update  : this.getUpdateData(init, data, id)
        };
    }

    isDiffEmpty(data){
        return isEmpty(data["add"]) && isEmpty(data["del"]) && isEmpty(data["update"]);
    }

    /**
     * 新增数据, 也就是在data中没有主键的数据(因主键是后台添加)
     * @param id
     */
    getAddData(data, id = "id"){
        let res = [];
        for(let i in data){
            if(isEmpty(data[i][id]))
                res.push(data[i]);
        }
        return res;
    }

    /**
     * 删除数据, 该类数据是在init中有而在data中没有的数据
     * @param id
     */
    getDelData(init, data, id = "id"){
        let res = [];
        for(let i in init){
            if( this.getKeyInArray(data, id, init[i][id]) === false )
                res.push(init[i]);
        }
        return res;
    }

    /**
     * 获取修改的数据, 在init和data中都有但不同的数据
     * @param key
     * @param id
     * @returns {Array}
     */
    getUpdateData(init, data, id = "id"){
        let res = [];
        for(let i in init){
            let val = this.getKeyInArray(data, id, init[i][id]);
            if(val !== false && !isEqual(val, init[i]))
                res.push(val);
        }
        return res;
    }

    /**
     * 用于判定用户和操作者, 来限定按钮的可用逻辑
     * 这里限定同一个操作者24小时内可用
     * @param dataKey
     * @param indexKey
     * @returns {*}
     */
    getBtnStateDisabled(dataKey = "data", indexKey = "selectRow"){
        let data = this.state[dataKey]
        let index = this.state[indexKey]
        try{
            let create_by = data[index].create_by;
            let create_time = data[index].create_time;
            return isEmpty(create_time) || create_by != Cache.getUid() || moment(create_time).format("YYYY-MM-DD") != moment().format("YYYY-MM-DD");
        }catch(e){
            return true;
        }
    }

    //当一个页面的弹出框过多时, 使用这部分的方法来控制弹出框的显示
    setVisible(key, key_visible = true){
        try{
            let visible = getVal(this.state.visible, {});
            visible[key] = key_visible && true;
            this.setState({
                visible: visible
            })
        } catch(e){}
    }

    setDisVisible(key){
        try{
            let visible = getVal(this.state.visible, {});
            visible[key] = false;
            this.setState({
                visible: visible
            })
        } catch(e){}
    }

    getVisible(key){
        try{
           return getVal(this.state.visible[key], false);
        } catch(e){}
    }

    //控制加载
    setLoading = (key, is_loading = true) => {
        try{
            let loading = getVal(this.state.loading, {});
            loading[key] = is_loading;
            this.setState({loading})
        } catch(e){}
    };

    getLoading = key => {
        try{
            return getVal(this.state.loading[key], false);
        } catch(e){}
    };

    //子组件函数触发器
    trigger_func = (key, ...args) => {
        let trigger_func = getVal(this.state.trigger_func, {});
        trigger_func[key] = args;
        this.setState({trigger_func}, () => {
            trigger_func[key] = false;
            this.setState({trigger_func});
        })
    };

    /**
     * arr是一个对象数组, 在arr中查找obj[key] = val的obj
     * @param arr
     * @param key
     * @param val
     * @returns {*}
     */
    getKeyInArray(arr, key, val){
        for(let i in arr){
            if(arr[i][key] && isEqual(arr[i][key], val))
                return arr[i];
        }
        return false;
    }
}

export default BaseComponent