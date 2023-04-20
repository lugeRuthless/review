/* eslint-disable @typescript-eslint/no-use-before-define */
import Button from '@/components/Button';
import Checkbox from '@/components/CheckBox';
import Input from '@/components/Input';

import Select from '@/components/Select';
import React, { useCallback, useEffect, useRef, useState } from 'react';
// import Dropdown from '@/components/Dropdown';
import { deThrottle } from '@/utils';
import ChooseSuggestionFeedback from '@/components/commonModals/chooseSuggestionFeedback';
import Divider from '@/components/Divider';
import LabelComp from '@/components/labelComp';
import NECaptcha from '@/components/NECaptcha';
import { TELEPHONE_AREA } from '@/static/constant';
import cs from 'classnames';
import { dvaDispatch, useSelector } from 'umi';
import { login as loginFunc } from '../../services';
import AutoComplete from './components/autoCompleteAccountsAndPassword';
import BindPhoneModal from './components/bindPhoneModal';
import TokenPass from './components/tokenPass';
import { quit_client } from '@/utils/common';

import Dropdown from '@/components/Dropdown';
import S from './index.less';
import { throttle } from 'lodash';
import { send } from '@/utils/request';
import { showGetBackAccount } from './components/getBackAccount';
import { playAudio } from '@/components/Audio';

// 渲染下拉框
const renderFlexBetween = (item: { label: string; value: string }) => (
  <div className={S.selectOption}>
    <span>{item.label}</span>
    <span>{item.value}</span>
  </div>
);

interface IProps {
  setRegister: () => void;
}

const execOldApp = throttle(() => {
  // 一秒延迟打不开，自动跳转下载
  const timeout = setTimeout(() => {
    shell.openExternal('https://www.5eplay.com/');
  }, 1000);
  ipcRenderer.invoke('open_old_exe').then((err?: string) => {
    clearTimeout(timeout);
    if (err) {
      shell.openExternal('https://www.5eplay.com/');
    }
  });
  quit_client();
}, 1000);

interface ITimeoutRef {
  timer?: number | undefined;
  countdown: number;
  num: number;
}

const defaultTimoutRef = {
  countdown: 15,
  num: 0,
};

const LoginBox: React.FC<IProps> = ({ setRegister }) => {
  const [isWechat, setIsWechat] = useState(false);
  const [isApp, setIsApp] = useState(false);
  const [area, setArea] = useState('+86');
  const [account, setAccount] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isRemember, setIsRemember] = useState(false);
  const [visible, setVisible] = useState(false);
  const [unValidatedParam, setUnValidatedParams] = useState('');
  const [errMsg, setErrMsg] = useState<React.ReactNode | string>('');
  const [wechatErrMsg, setWechatErrMsg] = useState<React.ReactNode | string>('');
  const [appErrMsg, setAppErrMsg] = useState<React.ReactNode | string>('');
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [bindPhoneVisible, setBindPhoneVisible] = useState(false);
  const [TokenPassVisible, setTokenPassVisible] = useState(false);
  const [clean, setClean] = useState(0);
  const cleanRef = useRef(0);
  const $handleLogin = useRef<(t: any) => Promise<any>>(() => Promise.reject());
  const [sweepCodeState, setSweepCodeState] = useState(0);
  const [isLogin, setIsLogin] = useState(false);
  const [appQrCode, setAppQrCode] = useState<any>({});
  const appQrCodeRef = useRef({});
  const loginBoxRef = useRef(null);
  const [reducedHeight, setReducedHeight] = useState(0);

  const qrCodeRef = useRef<any>({ current: {} });

  const captchaRef = useRef<any>({ current: {} });

  const timer = useRef<any>({ current: {} });

  const passwordRef = useRef<any>();

  const countdown = useRef<any>({ current: 30 });

  const accountsList = useSelector(({ login }: any) => login.accountsList);
  const apiHomeConfig = useSelector(({ status }: any) => status.apiHomeConfig);

  const data = FE.homeParams;
  const dataRef = useRef({});

  const timeoutRef = useRef<ITimeoutRef>(defaultTimoutRef);

  useEffect(() => {
    if (Array.isArray(accountsList) && accountsList.length > 0) {
      setAccount(accountsList?.[0]?.account);
      setPassword(accountsList?.[0]?.password);
      setArea(accountsList?.[0]?.area);
      setIsRemember(accountsList?.[0]?.remember);
    }
  }, [accountsList]);

  useEffect(() => {
    FE.addReport({ key: isWechat ? 'login_wechatqr_v' : 'login_phone_v' });
  }, [isWechat]);

  useEffect(() => {
    if (sessionStorage.getItem('errMsg')) {
      setErrMsg(sessionStorage.getItem('errMsg'));
      sessionStorage.removeItem('errMsg');
    }
    return () => {
      clearTimeoutTimer();
      timeoutRef.current = defaultTimoutRef;
    };
  }, []);

  const initWechatQRCode = () => {
    if (qrCodeRef.current) {
      qrCodeRef.current = null;
    }
    if (isWechat) {
      setTimeout(() => {
        qrCodeRef.current = new WxLogin({
          self_redirect: true,
          id: 'wechatQRCode',
          appid: dataRef.current?.wechat_login_config?.appid || data?.wechat_login_config?.appid,
          scope: 'snsapi_login',
          redirect_uri: dataRef.current?.wechat_login_config?.redirect_uri || data?.wechat_login_config?.redirect_uri,
          state: dataRef.current?.wechat_state_login || data?.wechat_state_login,
          style: 'white',
          href: 'https://static-arena.5eplay.com/css/loginWx.css',
        });
      }, 10);
    }
  };

  const clearWechatTimer = () => {
    window.clearInterval(timer.current);
  };

  // 改变微信扫码状态 - 扫码状态 0 二维码 1 待刷新 2登录违规 3返回账号登录
  // 改变app扫码状态 - 扫码状态 -2 扫码超时 -1 二维码失效 0 未处理 1 已扫码 2 扫码登录 3 取消登录
  const changeSweepCodeState = (type: number) => {
    setSweepCodeState(type);
    if (type === 0) {
      if (isWechat) {
        initWechatQRCode();
        startPolling();
        setErrMsg('');
        setWechatErrMsg('');
      } else if (isApp) {
        setAppErrMsg('');
        setErrMsg('');
        getAppQrCode((qrData: any) => {
          startPolling(qrData);
        });
      }
    } else {
      clearWechatTimer();
    }
  };

  const clearTimeoutTimer = () => {
    window.clearTimeout(timeoutRef.current?.timer);
    timeoutRef.current.timer = undefined;
  };

  // 超时定时器
  const initTimeoutTimer = () => {
    clearTimeoutTimer();
    timeoutRef.current.timer = window.setTimeout(() => {
      setIsLogin(false);
      timeoutRef.current.num++;
      if (timeoutRef.current?.num > 1) {
        setErrMsg('登录超时，请稍后再试');
      } else {
        setErrMsg('登录超时，请重试');
      }
    }, timeoutRef.current.countdown * 1000);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLogin = (payload: any = {}, isScanLogin: boolean = false) => {
    let params = {};
    if (isScanLogin) {
      params = payload;
    } else {
      if (isLogin) {
        return;
      }
      playAudio({ src: 'LOGIN_AUDIO' });
      FE.addReport({ key: 'login_phone_c' });
      if (!account) {
        setUnValidatedParams('account');
        setErrMsg('账号不能为空');
        return;
      }

      if (!password) {
        setUnValidatedParams('password');
        setErrMsg('密码不能为空');
        return;
      }
      params = {
        username: account,
        password,
        area,
        isRemember,
        ...payload,
      };

      setIsLogin(true);
    }

    initTimeoutTimer();

    loginFunc(params).then((res: any) => {
      clearTimeoutTimer();
      if (res.status) {
        if (isApp) {
          localStorage.setItem('loginWay', 'app_scan');
        } else if (isWechat) {
          localStorage.setItem('loginWay', 'wechat_scan');
        } else {
          localStorage.setItem('loginWay', 'account');
        }
        initTimeoutTimer();
      }
      if (!res?.status) {
        setIsLogin(false);
        if (res?.data?.error_key) {
          setUnValidatedParams(res.data.error_key);
        }

        const { code } = res;
        // const { code } = { code: 11 };

        // 扫码登录失败
        if (code === 1) {
          refreshAppQrCode();
          return;
        }

        // 密码错误三次及以上 需要易盾校验认证
        if (code === 5003) {
          captchaRef?.current?.popUp?.();
          return;
        }

        // 账号已冻结
        if (code === 5) {
          setErrMsg(
            <>
              {res.message}
              <a href={`${envConfig._g_home_5eplay_url}forum/18096`}>点击解除解冻</a>
            </>,
          );
          refreshAppQrCode();
          return;
        }

        // 未绑定steam账号
        if (code === 9) {
          setErrMsg(
            <p>
              <p>{res.message}</p>
              <p>
                <a
                  style={{
                    color: 'var(--aThemeColor)',
                    textDecoration: 'underline',
                  }}
                  onClick={goBind}
                >
                  前往绑定
                </a>
              </p>
            </p>,
          );
          return;
        }

        // 未绑定手机号的老用户
        if (code === 10) {
          setBindPhoneVisible(true);
          return;
        }

        // 微信扫码 账号已登录 踢下线
        if (code === 11 && isWechat) {
          const userName = res?.data?.username;
          setWechatErrMsg(
            <>
              <p className="wechatErrMsg">
                <p>{res.message}</p>
                <p>
                  <a
                    style={{
                      color: 'var(--aThemeColor)',
                      textDecoration: 'underline',
                      paddingTop: '3px',
                    }}
                    onClick={() => kickOnlineUser(userName)}
                  >
                    {FE.G_LANGUAGE[_g_deflang].login.accountKick}
                  </a>
                </p>
              </p>
            </>,
          );
          return;
        }

        // app扫码 账号已登录 踢下线
        // TODO
        if (code === 11 && isApp) {
          const userName = res?.data?.username;
          setAppErrMsg(
            <>
              <p className="appErrMsg">
                <p>{res.message}</p>
                <p>
                  <a
                    style={{
                      color: 'var(--aThemeColor)',
                      textDecoration: 'underline',
                      paddingTop: '3px',
                    }}
                    onClick={() => kickOnlineUser(userName)}
                  >
                    {FE.G_LANGUAGE[_g_deflang].login.accountKick}
                  </a>
                </p>
              </p>
            </>,
          );
          setSweepCodeState(0);
          return;
        }

        // 账号密码登录 账号已登录 踢下线
        if (code === 12) {
          setErrMsg(
            // <>
            //   <p className="tleft">
            //     {res.message}
            //     <a onClick={kickOnlineUser}>{FE.G_LANGUAGE[_g_deflang].login.accountKick}</a>
            //   </p>
            // </>,
            <>
              <p className="tcenter">
                <p>{res.message}</p>
                <p>
                  <a
                    style={{
                      color: 'var(--aThemeColor)',
                      textDecoration: 'underline',
                    }}
                    onClick={() => kickOnlineUser()}
                  >
                    {FE.G_LANGUAGE[_g_deflang].login.accountKick}
                  </a>
                </p>
              </p>
            </>,
          );
          return;
        }

        // 受信用户需要令牌
        if (code === 19) {
          $handleLogin.current = (d = {}) => loginFunc({ ...params, ...d });
          setTokenPassVisible(true);
          return;
        }

        // 单独toast提示
        if (code === 20) {
          FE.message.error(res.message);
          return;
        }

        // 用户名封禁
        if (code === 30) {
          setErrMsg(
            // <>
            //   <p className="tleft">
            //     {FE.G_LANGUAGE[_g_deflang].login.tips4}
            //     <a href={`${envConfig._g_home_5eplay_url}forum/18096`}>{FE.G_LANGUAGE[_g_deflang].login.tips4Link}</a>
            //   </p>
            // </>,
            <>
              <p className="tcenter">
                <p>{FE.G_LANGUAGE[_g_deflang].login.tips4}</p>
                <p>
                  <a href={`${envConfig._g_home_5eplay_url}forum/18096`}>{FE.G_LANGUAGE[_g_deflang].login.tips4Link}</a>
                </p>
              </p>
            </>,
          );
          return;
        }

        // 不在封测期间
        // if (code === 52 && FE.nowTime < cutOffTime) {
        //   setErrMsg(
        //     <p className="tcenter">
        //       <p>
        //         系统维护中，请前往老客户端进行游戏
        //         <a
        //           style={{
        //             color: '#fff',
        //             textDecoration: 'underline',
        //             marginLeft: '4px',
        //           }}
        //           onClick={execOldApp}
        //         >
        //           立即前往&gt;&gt;
        //         </a>
        //       </p>
        //     </p>,
        //   );
        //   return;
        // }

        setErrMsg(res.message);
        // refreshAppQrCode();
      }
    });

    setUnValidatedParams('');
    setErrMsg('');
    setWechatErrMsg('');
    setAppErrMsg('');
    setSweepCodeState(0);
  };

  // 需要刷新app二维码
  const refreshAppQrCode = () => {
    if (isApp) {
      getAppQrCode((qrData: any) => {
        startPolling(qrData);
      });
    }
  };

  // 轮询获取微信登录状态
  const getWechatLoginStatus = () => {
    let dataClean = null;
    if (cleanRef.current === 1) {
      dataClean = 1;
      // setClean(0);
      cleanRef.current = 0;
    }

    FE.getData('/api/user/wechat', {
      state: data?.wechat_state_login,
      clean: dataClean,
    }).then(res => {
      if (res?.status) {
        const token = res?.data?.token;
        if (token) {
          clearWechatTimer();
          handleLogin({ scan_token: token }, true);
        }
        // 未绑定微信 需要回到登录页 登录进去之后绑定微信
        if (res?.data?.status === -2) {
          FE.message.error('该微信还未绑定5E账号，请先使用账号密码登录，在登录后完成绑定', 3);
          // setClean(1);
          cleanRef.current = 1;
          handleChangeIsWechat(false);
          clearInterval(timer.current);
          clearWechatTimer();
          sessionStorage.bindWechat = true;

          dvaDispatch({
            type: 'home/update',
            payload: {
              settingModal: {
                visible: true,
                type: 'thirdParty',
              },
            },
          });
        }
      } else {
        // setClean(1);
        cleanRef.current = 1;
        clearWechatTimer();
        changeSweepCodeState(1);
        // FE.message.error(res?.message);
      }
    });
  };

  // 轮询获取app登录状态
  const getAppLoginStatus = (qrData: any) => {
    FE.getData('/api/auth/app_scan', {
      qrcode: qrData?.qrcode,
    }).then(res => {
      if (res?.status) {
        // scan_status -2 扫码超时 -1 二维码失效 0 未处理 1 已扫码 2 扫码登录 3 取消登录 4 跳过扫脸登录
        const { scan_status, qrcode, app_token } = res.data;
        setSweepCodeState(scan_status);
        if ([-2, -1, 3].includes(+scan_status)) {
          clearWechatTimer();
        }
        if (+scan_status === 2) {
          clearWechatTimer();
          handleLogin({ app_token: app_token, qrcode }, true);
        }
        if (+scan_status === 4) {
          clearWechatTimer();
          handleLogin({ app_token: app_token, qrcode, ignore_priority: 1 }, true);
        }
      } else {
        // setClean(1);
        cleanRef.current = 1;
        clearWechatTimer();
        changeSweepCodeState(-1);
        // setErrMsg(
        //   <>
        //     <p className="tcenter">
        //       <p>登录失败：账号已在别处登录</p>
        //       <p>
        //         <a
        //           style={{
        //             color: 'var(--aThemeColor)',
        //             textDecoration: 'underline',
        //           }}
        //           onClick={kickOnlineUser}
        //         >
        //           {FE.G_LANGUAGE[_g_deflang].login.accountKick}
        //         </a>
        //       </p>
        //     </p>
        //   </>,
        // );
        // FE.message.error(res?.message);
      }
    });
  };

  const startPolling = (qrData?: any) => {
    if (isWechat) {
      countdown.current = 30;
      timer.current = setInterval(() => {
        if (countdown.current <= 0) {
          clearWechatTimer();
          changeSweepCodeState(1);
          return;
        }
        getWechatLoginStatus();
        countdown.current = countdown.current - 3;
      }, 3000);
    }

    if (isApp) {
      countdown.current = 60;
      timer.current = setInterval(() => {
        if (countdown.current <= 0) {
          clearWechatTimer();
          changeSweepCodeState(-1);
          return;
        }
        getAppLoginStatus(qrData);
        countdown.current = countdown.current - 3;
      }, 3000);
    }
  };

  const getAppQrCode = (cb?: any) => {
    FE.getData('/api/auth/app_login').then(res => {
      if (res?.status) {
        setAppQrCode({
          ...res.data,
          // code_url: 'https://static.5eplay.com/images/home/download/guide-app.png',
        });
        appQrCodeRef.current = res.data;
        cb && cb(res.data);
      } else {
        clearWechatTimer();
        changeSweepCodeState(-1);
        // FE.message.error(res?.message);
      }
    });
  };

  useEffect(() => {
    const loginWay = localStorage.getItem('loginWay');

    if (loginWay === 'wechat_scan') {
      if (apiHomeConfig?.wechat_login_config?.appid) {
        dataRef.current = apiHomeConfig;
        handleChangeIsWechat(true);
      } else {
        setIsWechat(undefined);
      }
      return;
    }
  }, [apiHomeConfig]);

  useEffect(() => {
    const loginWay = localStorage.getItem('loginWay');
    if (loginWay === 'app_scan') {
      handleChangeIsApp(true);
      return;
    }

    if (loginWay === 'account') {
      return;
    }

    if (loginWay === 'wechat_scan') {
      return;
    }

    if (!(sessionStorage.getItem('isAccount') === 'true')) {
      handleChangeIsApp(true);
    } else {
      sessionStorage.removeItem('isAccount');
    }
    return () => {
      clearTimeoutTimer();
    };
  }, []);

  // useEffect(() => {
  //   handleChangeIsApp(true);
  // }, []);

  useEffect(() => {
    if (isWechat) {
      initWechatQRCode();
      startPolling();
      setErrMsg('');
      setWechatErrMsg('');
    } else {
      qrCodeRef.current = null;
      clearWechatTimer();
    }
    return () => clearWechatTimer();
  }, [isWechat]);

  useEffect(() => {
    if (isApp) {
      getAppQrCode((qrData: any) => {
        startPolling(qrData);
      });
    } else {
      clearWechatTimer();
    }

    return () => {
      clearWechatTimer();
    };
  }, [isApp]);

  // 更改登录方式
  const handleChangeIsWechat = (bool: boolean) => {
    if (bool) {
      // setClean(1);
      cleanRef.current = 1;
    }
    FE.addReport({ key: 'login_wechat_c' });
    if (!bool) {
      const iframe = document.getElementsByTagName('iframe');

      for (let index = 0; index < iframe.length; index++) {
        destroyIframe(iframe[index]);
      }
    }
    setIsWechat(bool);
    setErrMsg('');
    setUnValidatedParams('');
  };

  const destroyIframe = (iframe: any) => {
    iframe.src = 'about:blank';

    try {
      iframe.contentWindow.document.write('');
      iframe.contentWindow.document.clear();
    } catch (e) {}

    // 把iframe从页面移除
    iframe && iframe.parentNode.removeChild(iframe);
  };

  // 更改登录方式app登录
  const handleChangeIsApp = (bool: boolean) => {
    // FE.addReport({ key: 'login_app_c' });
    setIsApp(bool);
    setSweepCodeState(0);
    setAppQrCode({});
    appQrCodeRef.current = {};
    setErrMsg('');
    setUnValidatedParams('');
  };

  // 渲染title
  const renderTitle = () => (
    <>
      {/* <span style={{ fontWeight: 'bold', marginTop: 20 }}>{`${isWechat ? '微信' : isApp ? 'APP扫码' : ''}登录`}</span> */}
      <span style={{ fontWeight: 'bold', marginTop: 52 }}>{`${isWechat || isApp ? '扫码' : ''}登录`}</span>
    </>
  );

  // 开启时间
  const renderOpenTime = () => {
    return apiHomeConfig?.beta_limit_desc ? <span className={S.openTime}>{apiHomeConfig?.beta_limit_desc}</span> : null;
  };

  const autoComplete = (info: { account: string; password: string; remember: boolean; area: string }) => {
    setAccount(info.account);
    setPassword(info.password);
    setIsRemember(info.remember);
    setArea(info.area);
  };

  const onKeydown = useCallback(
    (e: any) => {
      if (e.keyCode === 13 && !e.shiftKey) {
        passwordRef.current && passwordRef.current.blur();
        e.preventDefault();
        handleLogin();
      }
    },
    [handleLogin],
  );

  // 渲染提交表单
  const renderForm = () => (
    <>
      <LabelComp label="账号" labelStyle={{ color: '#fff', fontWeight: '400' }}>
        <Select
          animation="slide-up"
          style={{ width: 77, height: 36 }}
          optionLabelProp="value"
          value={area}
          onChange={value => setArea(value)}
          dropdownMatchSelectWidth={false}
          className={S.selectArea}
          type="stroke"
          tabIndex={-1}
        >
          {TELEPHONE_AREA.map(i => (
            <Select.Option label={i.label} value={i.value} key={`${i.value}${i.label}`}>
              {renderFlexBetween(i)}
            </Select.Option>
          ))}
        </Select>
        <Input
          style={{ marginLeft: 3, borderRadius: 4, width: 190, verticalAlign: 'bottom' }}
          tabIndex={1}
          placeholder="手机号/邮箱/用户昵称"
          value={account}
          autoComplete="off"
          onFocus={() => setShowAutoComplete(true)}
          textIndent={16}
          onBlur={() =>
            setTimeout(() => {
              setShowAutoComplete(false);
            }, 50)
          }
          onFocusCapture={e => {
            e.target.classList.remove(S.error);
          }}
          onChange={e => {
            setAccount(e.target.value);
            setUnValidatedParams('');
            setErrMsg('');
          }}
          className={cs(S.inputClass, unValidatedParam === 'account' ? S.error : '')}
          onKeyDown={onKeydown}
        />
        <AutoComplete showAutoComplete={showAutoComplete} accountsList={accountsList || []} onChange={autoComplete} />
      </LabelComp>
      <LabelComp label="密码" labelStyle={{ color: '#fff', fontWeight: '400' }}>
        <Input
          type="password"
          showPassword
          placeholder="请输入密码"
          useRef={passwordRef}
          height={34}
          autoComplete="off"
          style={{ width: '100%', borderRadius: 4, letterSpacing: 5, color: '#5f6774' }}
          value={password}
          textIndent={16}
          className={cs(S.password, S.inputClass, {
            [S.error]: unValidatedParam === 'password' || unValidatedParam === 'account',
          })}
          onFocusCapture={e => {
            e.target.classList.remove(S.error);
          }}
          onKeyDown={onKeydown}
          onChange={e => {
            setPassword(e.target.value);
            setUnValidatedParams('');
            setErrMsg('');
          }}
        />
      </LabelComp>
    </>
  );

  const forgetPassword = useCallback(() => {
    // FE.appGoRouter({ link_url: envConfig._g_home_5eplay_url + 'user/verify_account' });
    showGetBackAccount();
  }, []);

  // 渲染密码操作栏
  const renderPasswordFuncLine = () => (
    <div className={S.selectFuncLine}>
      <span>
        <Checkbox
          className={S.checkBox}
          text="记住密码"
          checked={isRemember}
          onChange={checked => setIsRemember(checked)}
          tabIndex={-1}
        />
      </span>
      <span tabIndex={-1} className={S.forgetPassword} onClick={forgetPassword}>
        忘记密码或账号
      </span>
    </div>
  );

  // 渲染错误信息栏
  const renderErrorMsg = () => (
    <>
      {errMsg ? (
        <div style={{ bottom: 90 - reducedHeight }} className={S.errMsg}>
          {errMsg}
        </div>
      ) : null}
    </>
  );

  // 渲染错误信息栏
  const renderWechatErrorMsg = () => <>{wechatErrMsg ? <div className={S.errMsg}>{wechatErrMsg}</div> : null}</>;
  const renderAppErrorMsg = () => <>{appErrMsg ? <div className={S.errMsg}>{appErrMsg}</div> : null}</>;

  const goBind = () => {
    sessionStorage.bindInfo = JSON.stringify({
      username: account,
      password,
    });
    setRegister();
  };

  const kickOnlineUser = (userName = '') => {
    // userName: 如账号已登录，踢下线弹窗需显示扫码账号名称
    const newstate = {
      title: [FE.G_LANGUAGE[_g_deflang].common.tipsHeader, 'Tips'],
      okText: '确定',
      children: (
        <span
          style={{
            fontFamily: 'Microsoft YaHei-Bold, Microsoft YaHei',
            fontSize: 14,
          }}
        >
          {FE.G_LANGUAGE[_g_deflang].login.accountKickConfirm1}
          <span style={{ color: '#8855FF', fontWeight: 'bold' }}> {userName ? userName : account} </span>
          {FE.G_LANGUAGE[_g_deflang].login.accountKickConfirm2}
        </span>
      ),
      onOk: () => {
        FE.postData('/api/user/kick', {}).then(res => {
          if (res?.status) {
            FE.message.success(res?.message);
            if (isApp) {
              // refreshAppQrCode();
              clearWechatTimer();
              startPolling(appQrCodeRef.current);
            } else {
              initWechatQRCode();
              clearWechatTimer();
              startPolling();
            }
            setErrMsg('');
          } else {
            FE.message.error(res?.message);
          }
        });
      },
    };
    // @ts-ignore
    FE.openModal(newstate);
  };

  // 校验验证码成功
  const onCaptchaSuccess = (err: any, _data: { validate: string }) => {
    if (err) {
      return;
    }

    handleLogin({ validate: _data.validate });
  };

  useEffect(() => {
    if (loginBoxRef.current) {
      const handleResize = deThrottle((): void => {
        const { height } = loginBoxRef.current?.getBoundingClientRect();
        if (height < 720) {
          setReducedHeight(720 - height);
        } else {
          setReducedHeight(0);
        }
      }, 10);

      window.addEventListener('resize', handleResize);
      handleResize();
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [loginBoxRef]);

  // 渲染按钮
  const renderButton = () => (
    <Button
      style={{ width: '100%', marginTop: 84 - reducedHeight, fontSize: 16, fontWeight: 'bold', height: 44 }}
      type="primary"
      onClick={() => handleLogin()}
      tabIndex={-1}
    >
      {isLogin ? (
        <span className={S.buttonLoading}>
          <svg className="iconpark-icon">
            <use href="#jiazai" />
          </svg>
          登录中...
        </span>
      ) : (
        '立即登录'
      )}
    </Button>
  );

  // 渲染三方登录
  const renderTripartite = () => (
    <div className={S.container}>
      <div className={S.title}>
        <div className={S.doubleLine} />
        <span>第三方登录</span>
        <div className={S.doubleLine} />
      </div>
      <div className={S.thirdLoginCon}>
        <div className={S.app} onClick={() => handleChangeIsApp(true)}>
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <clipPath id="a">
                <rect rx="0" height="28" width="28" />
              </clipPath>
            </defs>
            <g clipPath="url(#a)">
              <path
                fill="#fff"
                d="m2.22 7.449 1.423-3.965q2.69-1.406 6.202-.864c3.51.543 4.642 2.478 4.778 2.745.136.267.976 2.049-.406 4.32-1.493 2.454-4.494 3.477-4.474 3.304q1.785-.653 2.898-2.541c1.113-1.888.992-3.65.203-4.829-.788-1.179-3.112-2.886-7.981-1.678l-.356 1.016q2.129-.613 4.016-.559c1.887.054 4.062 1.043 3.254 4.473-.808 3.43-3.395 4.748-7.575 4.625-4.18-.122-3.168-3.195-2.897-4.066q.467-1.079 1.321-1.677c.855-.599 2.553-1.69 5.084-.915q1.193.442.915 1.627c-.279 1.185-2.71 2.483-5.542 1.525q1.595-.122 2.339-.56c.743-.437 1.242-.605 1.169-1.524q-.075-.612-1.17-.61c-1.093.002-2.75.538-3.507 2.388-.758 1.851-.006 3.04 2.948 2.948q2.773-.33 4.118-1.88c1.345-1.551 1.426-2.692 1.423-3.203-.002-.51.096-2.063-2.084-2.185-2.18-.122-4.478.79-6.1 2.085Z"
                data-follow-fill="#000"
              />
            </g>
          </svg>
        </div>
        <div className={S.wechat} onClick={() => handleChangeIsWechat(true)}>
          <i
            className="iconfont"
            style={{
              fontSize: 28,
              position: 'relative',
              top: 9,
            }}
          >
            &#xe6b9;
          </i>
        </div>
      </div>
    </div>
  );

  // // 渲染三方登录
  const renderAccount = () => (
    <div className={S.accountCon} style={{ paddingTop: 85 - reducedHeight }}>
      <div
        className={cs(S.title, 'crp')}
        onClick={() => (isApp ? handleChangeIsApp(false) : handleChangeIsWechat(false))}
      >
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="a">
              <rect rx="0" height="17" width="17" />
            </clipPath>
          </defs>
          <g clipPath="url(#a)" style={{ mixBlendMode: 'passthrough' }}>
            <path
              fill="#ccc"
              fillRule="evenodd"
              d="m6.03 3.03.007-.006A.75.75 0 0 0 4.97 1.97l-3 3a.75.75 0 0 0 .53 1.28h11a.75.75 0 0 0 0-1.5H4.31l1.72-1.72Zm7.47 6.72h-11a.75.75 0 0 0 0 1.5h9.19l-1.72 1.72a.75.75 0 1 0 1.06 1.06l3-3a.75.75 0 0 0-.53-1.28Z"
              style={{ mixBlendMode: 'passthrough' }}
              data-follow-fill="#000"
            />
          </g>
        </svg>
        <span>账号密码登录</span>
      </div>
    </div>
  );

  const renderFooter = () => (
    <>
      <Dropdown
        arrow={false}
        trigger={['click']}
        menuData={[
          { key: 1, label: '简体中文' },
          // { key: 2, label: 'English' },
        ]}
      >
        <a className={S.chineseSimple}>
          <span>简体中文</span>
          <svg className="iconpark-icon">
            <use href="#down-7ncml467" />
          </svg>
        </a>
      </Dropdown>
      <Divider type="vertical" style={{ margin: '0 16px' }} />
      {!(isApp || isWechat) && (
        <>
          <a onClick={setRegister}>立即注册</a>
          <Divider type="vertical" style={{ margin: '0 16px' }} />
        </>
      )}
      <a onClick={() => setVisible(true)}>意见反馈</a>
    </>
  );

  const renderIcon = (width: number, height: number) => {
    return (
      <div className={S.tipsIcon}>
        <svg className={S.iconfont} style={{ width, height }}>
          <use href="#renovate" />
        </svg>
      </div>
    );
  };

  const renderWechatLogin = () => (
    <>
      <div className={cs(S.tips, S.scanTitle)}>
        <p style={{ marginBottom: 1 }}>微信扫码登录</p>
        <p>
          如二维码无法显示 <a href="https://arena.5eplay.com/help?article_id=196">点击查看解决方法</a>
        </p>
      </div>
      <div style={{ position: 'relative' }}>
        <div className={S.img} id="wechatQRCode" />
        {+sweepCodeState === 1 && (
          <div className={S.refresh} onClick={() => changeSweepCodeState(0)}>
            <p>二维码已失效</p>
            {renderIcon(34, 34)}
            <p>刷新</p>
          </div>
        )}
      </div>

      {/* {<div className={S.errMsgCon}>{renderWechatErrorMsg()}</div>} */}
      {
        <div className={S.errMsgCon} style={{ marginTop: 10 }}>
          {wechatErrMsg ? renderWechatErrorMsg() : renderErrorMsg()}
        </div>
      }
      {/* {renderAccount()} */}
    </>
  );

  const renderAppLogin = () => (
    <>
      <div className={S.scanTitle}>
        <p>5EPlay APP扫码登录</p>
      </div>
      {/* <div className={cs(S.img, S.bgImg)} style={{ backgroundImage: appQrCode.code_url, backgroundSize: '100% 100%' }}> */}
      <div className={cs({ [S.img]: sweepCodeState === 0 }, S.bgImg)}>
        <div style={{ backgroundImage: `url(${appQrCode.code_url})`, backgroundSize: '100% 100%' }} />
        {(+sweepCodeState === -1 || +sweepCodeState === -2) && (
          <div className={S.refresh} onClick={() => changeSweepCodeState(0)}>
            <p>二维码已失效</p>
            {renderIcon(34, 34)}
            <p>刷新</p>
          </div>
        )}
        {+sweepCodeState === 1 && (
          <div className={S.refresh}>
            <p>扫码完成</p>
            <svg className={S.tipsIconSuccess}>
              <use href="#phone" />
            </svg>

            <p>需在手机上确认</p>
          </div>
        )}
        {+sweepCodeState === 3 && (
          <div className={S.refresh} onClick={() => changeSweepCodeState(0)}>
            <p>登录失败</p>
            {renderIcon(34, 34)}
            <p>刷新</p>
          </div>
        )}
      </div>

      {/* {<div className={S.errMsgCon}>{renderAppErrorMsg()}</div>} */}
      {
        <div className={S.errMsgCon} style={{ marginTop: 50 }}>
          {appErrMsg ? renderAppErrorMsg() : renderErrorMsg()}
        </div>
      }
      {/* {renderAccount()} */}
    </>
  );

  return (
    <>
      <div className={S.loginBox} ref={loginBoxRef}>
        <div className={S.loginBoxContainer}>
          <div className={S.title}>{renderTitle()}</div>
          {renderOpenTime()}

          {isWechat || isWechat === undefined ? (
            <>
              <div className={S.wechatContent}>{renderWechatLogin()}</div>
              <div className={S.tripartite}>{renderAccount()}</div>
            </>
          ) : isApp ? (
            <>
              <div className={S.appContent}>{renderAppLogin()}</div>
              <div className={S.tripartite}>{renderAccount()}</div>
            </>
          ) : (
            <>
              <div className={S.content}>
                {renderForm()}
                {renderPasswordFuncLine()}
                {renderErrorMsg()}
                {renderButton()}
              </div>
              {apiHomeConfig?.beta_limit_desc ? <div className={S.betaTips}>仅受邀用户可登录当前版本</div> : null}
              <div className={S.tripartite}>{renderTripartite()}</div>
            </>
          )}
        </div>
        {/* 意见反馈弹窗 */}
        <ChooseSuggestionFeedback visible={visible} handleCancel={() => setVisible(false)} footer={false} />
        <div className={S.footer}>{renderFooter()}</div>
        <NECaptcha getPopUp={popUp => (captchaRef.current.popUp = popUp)} onSuccess={onCaptchaSuccess} />
        <BindPhoneModal
          info={{
            username: account,
            password,
            area,
            isRemember: true,
          }}
          visible={bindPhoneVisible}
          onCancel={() => {
            setBindPhoneVisible(false);
            refreshAppQrCode();
          }}
        />
      </div>
      {TokenPassVisible && (
        <TokenPass
          handleCancel={() => {
            setTokenPassVisible(false);
            refreshAppQrCode();
          }}
          handleLogin={$handleLogin}
        />
      )}
    </>
  );
};

export default LoginBox;
