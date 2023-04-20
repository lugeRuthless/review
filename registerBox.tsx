import Button from '@/components/Button';
import Checkbox from '@/components/CheckBox';
import Input from '@/components/Input';
import InputButton from '@/components/InputButton';
import LabelComp from '@/components/labelComp';
import NECaptcha from '@/components/NECaptcha';
import Select from '@/components/Select';
import { login } from '@/pages/Login/services';
import { TELEPHONE_AREA } from '@/static/constant';
import { bindSteamId } from '@/utils/electron';
import { send } from '@/utils/request';
import cx from 'classnames';
import md5 from 'js-md5';
import { sha256 } from 'js-sha256';
import { deThrottle } from '@/utils';
import React, { useEffect, useRef, useState } from 'react';
import BindPhoneModal from '../loginBox/components/bindPhoneModal';

import S from './index.less';

interface IProps {}

/** 注册步骤 */
const REGISTING_STEP = [1, 2];

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

const RegisterBox: React.FC<IProps> = ({ setRegister }) => {
  // step分5布 1.填写手机号和验证码 2.注册用户名密码 3.绑定steam 4.绑定steam中(loading) 5.绑定steam失败 6.绑定成功页面
  const stepValue = ['1/3', '2/3', '3/3'];
  const stepLabel = ['注册', '完善信息', '绑定Steam'];

  const [step, setStep] = useState(1);
  const [isAgree, setIsAgree] = useState(false);
  const [area, setArea] = useState('+86');
  const [telephone, setTelephone] = useState('');
  const [count, setCount] = useState(0);
  const [accountInfo, setAccountInfo] = useState({
    account: '',
    password: '',
    passwordConfirm: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  // 注册的手机号是否已经被使用
  const [isMobileUsed, setIsMobileUsed] = useState(false);
  const [bindPhoneVisible, setBindPhoneVisible] = useState(false);
  // 验证码
  const [code, setCode] = useState('');
  const [unValidatedParam, setUnValidatedParams] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [reducedHeight, setReducedHeight] = useState(0);

  const captchaRef = useRef<any>({ current: {} });

  const timeCountRef = useRef<any>(null);
  const timeloadingRef = useRef<any>(null);
  const registerBoxRef = useRef(null);

  // 验证码60s倒计时
  const countCaptcha = () => {
    if (timeCountRef.current) {
      return;
    }
    timeCountRef.current = setInterval(() => {
      setCount(nCount => nCount - 1);
    }, 1000);
  };

  useEffect(() => {
    if (sessionStorage.bindInfo) {
      const { username, password } = JSON.parse(sessionStorage.bindInfo);
      setAccountInfo({
        account: username,
        password,
        passwordConfirm: password,
      });
      setStep(3);
      sessionStorage.removeItem('bindInfo');
    }
    return () => {
      window.clearInterval(timeCountRef.current);
      timeCountRef.current = null;

      window.clearInterval(timeloadingRef.current);
      timeloadingRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (count === 0) {
      window.clearInterval(timeCountRef.current);
      timeCountRef.current = null;
    }
  }, [count]);

  useEffect(() => {
    switch (+step) {
      case 1:
        FE.addReport({ key: 'register_phone_v' });
        break;
      case 2:
        FE.addReport({ key: 'register_account_v' });
        break;
      case 3:
        FE.addReport({ key: 'register_steam_v' });
        break;
      default:
    }
  }, [step]);

  const resetValidatedAndCheckType = (e: any, type: string, validatedParam: string) => {
    const value = e.target.value;

    if (type === 'number' && value && !value.match(/^\d+$/g)) {
      setErrMsg('请输入纯数字');
      setUnValidatedParams(validatedParam);
      return;
    }

    if (validatedParam === unValidatedParam) {
      setUnValidatedParams('');
      setErrMsg('');
    }
  };

  // 获取验证码
  const getCode = () => {
    if (!telephone) {
      setErrMsg('请填写手机号');
      setUnValidatedParams('telephone');
      return false;
    }
    if (count > 0) {
      return;
    }

    captchaRef?.current?.popUp?.();
  };

  // 渲染提交表单
  const renderForm = () => (
    <>
      {step === 1 && (
        <>
          <LabelComp label="填写手机号" labelStyle={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            <Select
              style={{ width: 77, height: 36 }}
              optionLabelProp="value"
              value={area}
              onChange={value => setArea(value)}
              dropdownMatchSelectWidth={false}
              type="stroke"
              className={S.selectArea}
            >
              {TELEPHONE_AREA.map(i => (
                <Select.Option label={i.label} value={i.value} key={`${i.value}${i.label}`}>
                  {renderFlexBetween(i)}
                </Select.Option>
              ))}
            </Select>
            <Input
              style={{ width: 190, marginLeft: 3, verticalAlign: 'bottom' }}
              placeholder="请输入手机号"
              className={cx(S.inputClass, unValidatedParam === 'telephone' ? S.error : '')}
              value={telephone}
              onChange={e => {
                setErrMsg('');
                setUnValidatedParams('');
                setTelephone(e.target.value);
              }}
              textIndent={16}
              onKeyUp={e => resetValidatedAndCheckType(e, 'number', 'telephone')}
            />
          </LabelComp>
          <div className={S.inputButton}>
            <InputButton
              placeholder="请输入验证码"
              textIndent={12}
              inputClassName={cx(S.input, { [S.error]: unValidatedParam === 'code' })}
              inputStyle={{ width: 186, height: 36, borderRadius: '4px 0 0 4px' }}
              buttonClassName={cx(S.button, { [S.disabled]: count > 0 })}
              buttonText={count > 0 ? `等待${count}秒` : '获取验证码'}
              onClick={getCode}
              value={code}
              inputType={'text'}
              onChange={value => setCode(value)}
              onKeyUp={e => resetValidatedAndCheckType(e, 'number', 'code')}
              maxLength={6}
            />
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <LabelComp label="用户昵称" labelStyle={{ color: '#fff', fontSize: 14, fontWeight: '400' }}>
            <Input
              placeholder="请输入用户昵称"
              className={unValidatedParam === 'account' || unValidatedParam === 'account&password' ? S.error : ''}
              value={accountInfo.account}
              onChange={e => {
                setErrMsg('');
                setUnValidatedParams('');
                setAccountInfo({ ...accountInfo, account: e.target.value });
              }}
              textIndent={16}
            />
          </LabelComp>
          <LabelComp label="密码" labelStyle={{ color: '#fff', fontSize: 14, fontWeight: '400' }}>
            <Input
              type="password"
              placeholder="请输入密码"
              showPassword
              className={cx(
                S.password,
                unValidatedParam === 'password' || unValidatedParam === 'account&password' ? S.error : '',
              )}
              value={accountInfo.password}
              onChange={e => {
                setErrMsg('');
                setUnValidatedParams('');
                setAccountInfo({ ...accountInfo, password: e.target.value });
              }}
              maxLength={16}
              textIndent={16}
            />
            <div className={S.passwordTips}>8-16位，包含数字、大写字母、小写字母、特殊字符中的三种</div>
          </LabelComp>
          <LabelComp label="确认密码" labelStyle={{ color: '#fff', fontSize: 14, fontWeight: '400' }}>
            <Input
              type="password"
              placeholder="请再次输入密码"
              showPassword
              value={accountInfo.passwordConfirm}
              className={cx(S.password, unValidatedParam === 'passwordConfirm' ? S.error : '')}
              onChange={e => {
                setErrMsg('');
                setUnValidatedParams('');
                setAccountInfo({
                  ...accountInfo,
                  passwordConfirm: e.target.value,
                });
              }}
              maxLength={16}
              textIndent={16}
            />
          </LabelComp>
        </>
      )}
    </>
  );

  const nextStep = (stepParam?: number) => {
    setUnValidatedParams('');
    setErrMsg('');
    setStep(nStep => (stepParam ? stepParam : nStep + 1));
  };

  const handleButtonClick = () => {
    // FE.message.error('请输入正确手机号');
    if (step === 1) {
      FE.addReport({ key: 'register_accountnext_c' });
      if (!telephone) {
        setErrMsg('请输入手机号');
        setUnValidatedParams('telephone');
        return;
      }
      if (!code) {
        setErrMsg('请输入验证码');
        setUnValidatedParams('code');
        return;
      }

      const params = {
        mobile: telephone,
        area,
        code,
      };

      FE.postData('/api/auth/code', params).then(res => {
        if (res.status) {
          nextStep();
        } else {
          setErrMsg(res.message);
        }
      });

      return;
    }
    if (step === 2) {
      FE.addReport({ key: 'register_steamnext_c' });
      if (!accountInfo.account && !accountInfo.password) {
        setErrMsg('用户名、密码不能为空');
        setUnValidatedParams('account&password');
        return;
      }
      if (!accountInfo.account) {
        setErrMsg('请输入账号名');
        setUnValidatedParams('account');
        return;
      }
      if (!accountInfo.password) {
        setErrMsg('请输入密码');
        setUnValidatedParams('password');
        return;
      }
      if (!accountInfo.passwordConfirm) {
        setErrMsg('请再次输入密码');
        setUnValidatedParams('passwordConfirm');
        return;
      }
      if (accountInfo.password !== accountInfo.passwordConfirm) {
        setErrMsg('两次密码输入不一致');
        setUnValidatedParams('passwordConfirm');
        return;
      }
      if (!isAgree) {
        setErrMsg('注册前请先阅读并同意以下条款');
        return;
      }
      setErrMsg('');
      setUnValidatedParams('');
      const params = {
        mobile: telephone,
        area,
        code,
        username: accountInfo.account,
        password: accountInfo.password,
      };
      FE.postData('/api/auth/register', params).then(res => {
        if (res.status) {
          nextStep();
        } else {
          setErrMsg(res.message);
          // FE.message.error(res.message);
        }
      });
      return;
    }
    if (step === 3 || step === 5) {
      FE.addReport({ key: 'register_steam_c' });
      setIsLoading(true);
      nextStep(4);
      timeloadingRef.current = setTimeout(() => {
        bindSteamId()
          .then(() => {
            // 绑定成功 登录
            nextStep(6);
            // nextStep();
          })
          .catch(err => {
            nextStep();
            setErrMsg(err);
            FE.addReport({
              key: 'register_steam_r',
              data: '0',
            });
          })
          .finally(() => {
            setIsLoading(false);
          });
      }, 2000);
      return;
    }
    nextStep();
  };

  const handleLogin = () => {
    login({
      username: accountInfo.account,
      password: accountInfo.password,
      isRemember: true,
    }).then((res: any) => {
      console.log(res);
      FE.addReport({
        key: 'register_steam_r',
        data: '1',
      });
      if (!res?.status) {
        const { code: loginCode } = res;
        if (res?.message) {
          setErrMsg(res?.message);
        }
        // 未绑定手机号的老用户
        if (loginCode === 10) {
          setBindPhoneVisible(true);
          return;
        }
        // 单独toast提示
        if (loginCode === 20) {
          FE.message.error(res.message);
          return;
        }

        sessionStorage.setItem('errMsg', res?.message);
        setRegister();
      }
    });
  };

  // 渲染按钮
  const renderButton = () => {
    const buttonStyle = {
      width: '100%',
      fontSize: 16,
      height: 44,
      marginTop: 41,
      fontWeight: 'bold',
      display: 'inline-flex',
      justifyContent: 'center',
      alignItems: 'center',
    };

    let buttonText: string | React.ReactNode = '下一步';

    switch (step) {
      case 2:
        buttonStyle.marginTop = 81 - reducedHeight;
        break;
      case 3:
        buttonText = '读取本机Steam信息';
        buttonStyle.marginTop = 16;
        break;
      case 4:
        buttonText = (
          <span className={S.buttonLoading}>
            <svg className="iconpark-icon">
              <use href="#jiazai" />
            </svg>
            读取中...
          </span>
        );
        buttonStyle.marginTop = 16;
        break;
      case 5:
        // buttonText = '读取本机Steam信息';
        buttonText = '再次绑定';
        buttonStyle.marginTop = reducedHeight ? 24 : 58;
        break;
      default:
        break;
    }

    return (
      <Button style={buttonStyle} type="primary" onClick={handleButtonClick} loading={isLoading}>
        {buttonText}
      </Button>
    );
  };

  // 渲染注册协议
  const renderAgreement = () => {
    const agreement = (
      <>
        <a onClick={e => e.stopPropagation()} href="https://arena.5eplay.com/page/agreement">
          《服务条款》
        </a>
        与
        <a onClick={e => e.stopPropagation()} href="https://arena.5eplay.com/page/privacy">
          《个人信息保护政策》
        </a>
        和
        <a onClick={e => e.stopPropagation()} href="https://arena.5eplay.com/page/privacyguidelines">
          《个人信息保护指引》
        </a>
      </>
    );

    return (
      <div
        style={{ marginTop: 61 - reducedHeight < 24 ? 24 : 61 - reducedHeight }}
        className={cx(S.agreement, { [S.mt25]: +step === 2 })}
      >
        {step === 1 ? (
          <>
            注册即表示您同意
            {agreement}
          </>
        ) : (
          <Checkbox
            text={
              <>
                我已阅读并同意
                {agreement}
              </>
            }
            className={cx({ [S.checked]: isAgree }, S.agreementCon)}
            checkBoxClassName={S.agreementCheckbox}
            checked={isAgree}
            onChange={checked => {
              setIsAgree(checked);
            }}
          />
        )}
      </div>
    );
  };

  const renderLegend = () => (
    <div className={S.legend}>
      <div className={S.legendContent}>
        <div className={S.imgs}>
          <span>
            <i className="iconfont" style={{ fontSize: 63 }}>
              &#xe6b6;
            </i>
          </span>
          {step === 5 ? (
            <span style={{ color: '#F04949' }}>
              <i className="iconfont" style={{ fontSize: 20, opacity: 0.2 }}>
                &#xe6b8;
              </i>
              <i className="iconfont" style={{ fontSize: 20 }}>
                &#xe6b7;
              </i>
              <i className="iconfont" style={{ fontSize: 20, opacity: 0.2 }}>
                &#xe6b8;
              </i>
            </span>
          ) : (
            <span className={S.arrow} />
          )}
          <span>
            <i className="iconfont" style={{ fontSize: 63 }}>
              &#xe6b5;
            </i>
          </span>
          {step === 4 && (
            <>
              <div className={cx(S.halo, S.animation1)} />
              <div className={cx(S.halo, S.animation2)} />
            </>
          )}
        </div>
        {step === 5 && <div className={S.bindFailText}>{errMsg}</div>}
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className={S.footer}>
      <div className={S.bottomLine} />
      已有5E账号？
      <a onClick={setRegister} style={{ fontWeight: 'bold' }}>
        立即登录
      </a>
    </div>
  );

  const isRegisting = REGISTING_STEP.includes(step);

  const renderBindingGuide = (children: React.ReactNode) => {
    const renderLine = (number: number, FLine: React.ReactNode, SLine: React.ReactNode) => (
      <div className={S.cellLine}>
        <div className={S.number}>{number}</div>
        <div className={S.intro}>
          <div className={cx(S.introText)}>
            <div>{FLine}</div>
            <div>{SLine}</div>
          </div>
        </div>
      </div>
    );
    return (
      <div className={S.bindingGuide}>
        <div className={S.text}>绑定指引</div>
        {renderLine(
          1,
          <div className={S.text}>启动Steam或蒸汽平台</div>,
          <>
            <i className="iconfont" style={{ fontSize: 23, color: '#54A0FF' }}>
              &#xe6b5;
            </i>{' '}
            <span style={{ verticalAlign: 'text-bottom', margin: '0 4px 0 2px' }}>Or</span>
            <i className="iconfont" style={{ fontSize: 23, color: '#CE3B28' }}>
              &#xe6b5;
            </i>
          </>,
        )}
        {renderLine(
          2,
          <div className={S.text}>登录需要绑定的Steam或者蒸汽平台账号</div>,
          <div className={S.text}>（同一账号无法重复绑定）</div>,
        )}
        {renderLine(
          3,
          <div className={S.text} style={{ marginTop: 5 }}>
            保持Steam或蒸汽平台为在线状态
          </div>,
          <>
            <div className={S.steamOnline} />
          </>,
        )}
        {children}
        <div className={S.tips}>
          <a
            href="https://hzsfkjyxgs2.qiyukf.com/client?k=49aad8fc99712546fb2b337238b24152&wp=1&gid=481385787&robotShuntSwitch=1&robotId=5261801"
            target="__blank"
          >
            联系客服
          </a>
        </div>
      </div>
    );
  };

  const renderTitle = () => (
    <div className={S.title}>
      <span style={{ fontWeight: 'bold', display: 'block' }}>
        <span className={S.stepInfo}>{stepValue[step > 3 ? 2 : step - 1]}</span>
        {/* {isRegisting ? '注册' : '绑定Steam'} */}
        <span>{stepLabel[step > 3 ? 2 : step - 1]}</span>
      </span>
      <span
        onClick={() => {
          sessionStorage.setItem('isAccount', 'true');
          setRegister();
        }}
      >
        返回登录页
      </span>
    </div>
  );

  const renderTips = () => {
    return (
      <div className={S.bindTips}>
        <svg className="iconpark-icon">
          <use href="#tishi"></use>
        </svg>
        <span>确认steam账号在线并开始绑定</span>
      </div>
    );
  };

  // 渲染错误信息栏
  const renderErrorMsg = () => <div className={S.errMsg}>{errMsg}</div>;

  const renderContent = () => (
    <div
      className={S.content}
      style={step === 5 ? { marginTop: 60 - reducedHeight < 24 ? 24 : 60 - reducedHeight } : {}}
    >
      {isRegisting ? renderForm() : renderLegend()}
      {+step === 1 ? (
        <>
          <div style={{ marginTop: 18 }}>{renderErrorMsg()}</div>
          {renderButton()}
          {/* {isRegisting && renderAgreement()} */}
        </>
      ) : (
        <>
          {step < 5 && renderErrorMsg()}
          {step === 5 ? renderBindingGuide(renderButton()) : renderButton()}
          {isRegisting && renderAgreement()}
          {[3, 4].includes(step) && renderTips()}
        </>
      )}
    </div>
  );

  const renderBindSuccess = () => {
    const buttonStyle = {
      width: '100%',
      fontSize: 16,
      height: 44,
      marginTop: 41,
      fontWeight: 'bold',
      display: 'inline-flex',
      justifyContent: 'center',
      alignItems: 'center',
    };

    return (
      <div className={S.content}>
        <div className={S.contentSuccess}>
          <div className={S.successInfo}>
            <svg className="iconpark-icon">
              <use href="#check"></use>
            </svg>
            <span>绑定成功！</span>
          </div>
          <div className={S.btnGroup}>
            <Button style={{ ...buttonStyle, marginTop: 71 }} type="primary" onClick={() => handleLogin()}>
              开启5E生涯
            </Button>
            <Button
              style={{ ...buttonStyle, marginTop: 20 }}
              type="default"
              onClick={() => {
                sessionStorage.setItem('isAccount', 'true');
                send('login', {
                  area: area,
                  account: accountInfo.account,
                  password: accountInfo.password,
                  remember: true,
                });
                setRegister();
              }}
            >
              返回登录页
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 校验验证码成功
  const onCaptchaSuccess = (err: any, data: { validate: string }) => {
    setUnValidatedParams('');
    if (err) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (!telephone) {
      FE.message.error(FE.G_LANGUAGE[localStorage.getItem('language') || 'zh-cn'].emptyMobileError, 1.5);

      return false;
    }

    setIsLoading(true);
    const formdata = new FormData();
    formdata.append('mobile', telephone);
    formdata.append('area', area);
    formdata.append('sms_pass', sha256(sha256(telephone + md5(telephone) + '5eplay').substr(13, 8)).substr(19, 8));
    formdata.append('validate', data.validate);
    formdata.append('from', 'reg');
    FE.postData('/api/auth/mobile', formdata).then((res: any) => {
      setIsLoading(false);
      if (res.status) {
        setCount(60);
        countCaptcha();
        return;
      } else {
        FE.message.error(res.message, 1.5);
        setUnValidatedParams(res.data?.error_key);
        setErrMsg(res.message);
        setIsMobileUsed(+res.errcode === 11);
      }
    });
  };

  useEffect(() => {
    if (registerBoxRef.current) {
      const handleResize = deThrottle((): void => {
        const { height } = registerBoxRef.current?.getBoundingClientRect();
        if (step === 5 && height < 750) {
          setReducedHeight(750 - height);
        } else if (height < 720) {
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
  }, [registerBoxRef, step]);

  return (
    <div className={S.registerBox} ref={registerBoxRef}>
      <div className={S.registerBoxContainer}>
        {step !== 6 && renderTitle()}
        {step === 6 ? renderBindSuccess() : renderContent()}
        <NECaptcha getPopUp={popUp => (captchaRef.current.popUp = popUp)} onSuccess={onCaptchaSuccess} />
      </div>
      {/* {renderFooter()} */}
      <BindPhoneModal
        info={{
          username: accountInfo.account,
          password: accountInfo.password,
          area,
          isRemember: true,
        }}
        visible={bindPhoneVisible}
        onCancel={() => {
          setBindPhoneVisible(false);
          setRegister();
        }}
      />
    </div>
  );
};

export default RegisterBox;
