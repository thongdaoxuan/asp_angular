import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { TokenService, LogService, UtilsService } from 'abp-ng2-module';
import { AppConsts } from '@shared/AppConsts';
import { UrlHelper } from '@shared/helpers/UrlHelper';
import {
    AuthenticateModel,
    AuthenticateResultModel,
    TokenAuthServiceProxy,
    UserLoginAttemptsInforDto,
    UserLoginAttemptsService,
    UserServiceProxy,
} from '@shared/service-proxies/service-proxies';
import { AppSessionService } from '@shared/session/app-session.service';

@Injectable()
export class AppAuthService {
    authenticateModel: AuthenticateModel;
    authenticateResult: AuthenticateResultModel;
    rememberMe: boolean;
    appSession: AppSessionService;
    constructor(
        private _tokenAuthService: TokenAuthServiceProxy,
        private _router: Router,
        private _utilsService: UtilsService,
        private _tokenService: TokenService,
        private _userService: UserServiceProxy,
        private _logService: LogService,
        private _userLoginAttemptsService: UserLoginAttemptsService,
        injector: Injector
    ) {
        this.clear();
        this.appSession = injector.get(AppSessionService);
    }

    async logout(reload?: boolean) {
        await this._userService
        .updateLoginState(
            this.appSession.userId
        )
        .subscribe((result) => {
            abp.auth.clearToken();
            abp.utils.deleteCookie(AppConsts.authorization.encryptedAuthTokenName);
            if (reload !== false) {
                location.href = AppConsts.appBaseUrl;
            }
        });
    }

    authenticate(finallyCallback?: () => void): void {
        this._userLoginAttemptsService
        .getUserLoginAttempt(
            this.authenticateModel.userNameOrEmailAddress
        )
        .subscribe((result: UserLoginAttemptsInforDto) => {
            if(!!result && !!result.browserInfo && result.browserInfo != navigator.userAgent ){
                console.log("browser errorr. logout-------------------!!!!!!!!!!!!!!!!!!!!!", result)
                this.logout();
                return false;
            }
        });
        finallyCallback = finallyCallback || (() => { });
      
        this._tokenAuthService
            .authenticate(this.authenticateModel)
            .pipe(
                finalize(() => {
                    finallyCallback();
                })
            )
            .subscribe(async(result: AuthenticateResultModel) => {
                await this.processAuthenticateResult(result);
            });
    }

    private async processAuthenticateResult(
        authenticateResult: AuthenticateResultModel
    ) {
        this.authenticateResult = authenticateResult;

        if (authenticateResult.accessToken) {
            // Successfully logged in
            this.login(
                authenticateResult.accessToken,
                authenticateResult.encryptedAccessToken,
                authenticateResult.expireInSeconds,
                this.rememberMe
            );
            await this._userService.updateLoginState(this.authenticateResult.userId).subscribe((result) => {
                console.log("login ok===")
            });;

        } else {
            // Unexpected result!

            this._logService.warn('Unexpected authenticateResult!');
            this._router.navigate(['account/login']);
        }
    }

    private login(
        accessToken: string,
        encryptedAccessToken: string,
        expireInSeconds: number,
        rememberMe?: boolean
    ): void {
        const tokenExpireDate = rememberMe
            ? new Date(new Date().getTime() + 1000 * expireInSeconds)
            : undefined;

        this._tokenService.setToken(accessToken, tokenExpireDate);

        this._utilsService.setCookieValue(
            AppConsts.authorization.encryptedAuthTokenName,
            encryptedAccessToken,
            tokenExpireDate,
            abp.appPath
        );
       

        let initialUrl = UrlHelper.initialUrl;
        if (initialUrl.indexOf('/login') > 0) {
            initialUrl = AppConsts.appBaseUrl;
        }

        location.href = initialUrl;
    }

    private clear(): void {
        this.authenticateModel = new AuthenticateModel();
        this.authenticateModel.rememberClient = false;
        this.authenticateResult = null;
        this.rememberMe = false;
    }
}
