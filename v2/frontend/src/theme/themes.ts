const darkBase = "#121212";
const dark05 = "#191919";
const dark10 = "#2b2b2b";
const dark15 = "#383838";
const dark20 = "#454545";
const dark25 = "#525252";
const dark45 = "#666666";
const dark60 = "#ababab";

// these are the gradients used in the logo (from light to dark)
// const blueFrom = "#28aae2";
// const blueTo = "#146b91";
// const blueGradient = `linear-gradient(${blueFrom}, ${blueTo})`;
// const orangeFrom = "#fbb03b";
// const orangeTo = "#f05a24";
// const orangeGradient = `linear-gradient(${orangeFrom}, ${orangeTo})`;
// const purpleFrom = "#ed1e79";
// const purpleTo = "#5f2583";
// const purpleGradient = `linear-gradient(${purpleFrom}, ${purpleTo})`;

export interface Theme {
    name: string;
    label: string;

    bg: string;
    txt: string;

    error: string;
    accent: string;

    notificationBar: {
        bg: string;
        txt: string;
    };

    reaction: {
        bg: string;
        txt: string;
    };

    timeline: {
        txt: string;
        bg: string;
    };

    section: {
        bg: string;
        txt: string;
        bd: string;
    };

    "sub-section": {
        bg: string;
    };

    toast: {
        failure: {
            bg: string;
            txt: string;
        };
        success: {
            bg: string;
            txt: string;
        };
    };

    input: {
        bg: string;
        txt: string;
        bd: string;
    };

    participants: {
        bg: string;
        txt: string;
        hv: string;
        bd: string;
    };

    entry: {
        bg: string;
        bd: string;
        input: {
            txt: string;
            bg: string;
        };
    };

    panel: {
        bg: string;
        left: {
            bg: string;
        };
    };

    currentUser: {
        bd: string;
        bg: string;
        txt: string;
        ic: string;
    };

    avatar: {
        bg: string;
        bd: string;
        sh: string;
    };

    chatSearch: {
        bg: string;
        txt: string;
        bd: string;

        section: {
            txt: string;
        };
    };

    chatSummary: {
        bg: string;
        hv: string;
        txt1: string;
        txt2: string;
        bd: string;
        "bd-selected": string;
    };

    spinner: string;

    menu: {
        bg: string;
        txt: string;
        "disabled-txt": string;
        bd: string;
        hv: string;
        sh: string;
    };

    button: {
        bg: string;
        hv: string;
        txt: string;
        bd: string;
        disabled: string;
        spinner: string;
        "disabled-txt": string;
        "disabled-bd": string;
    };

    link: {
        underline: string;
    };

    modal: {
        txt: string;
        bg: string;
        sh: string;
        filter: string;
        header: {
            txt: string;
            bg: string;
            bd: string;
        };
        footer: {
            txt: string;
            bg: string;
            bd: string;
        };
    };

    modalPage: {
        bg: string;
        txt: string;
        sh: string;
        filter: string;
        bd: string;
        "txt-sh": string;
    };

    currentChat: {
        header: {
            bg: string;
            txt: string;
            bd: string;
        };
        msgs: {
            bg: string;
        };
        msg: {
            bg: string;
            txt: string;
            hv: string;
            bd: string;

            me: {
                bg: string;
                txt: string;
                hv: string;
                bd: string;
            };
        };
    };

    icon: {
        color: string;
        hv: string;
    };
}

export type Themes = {
    light: Theme;
    dark: Theme;
};

const defaultTheme = {
    name: "light",
    label: "Light",

    bg: "linear-gradient(#22A7F2, #5f2583)",
    txt: "#191919",
    error: "#CF6679",
    accent: "hotpink",

    notificationBar: {
        bg: "#f79031",
        txt: "#ffffff",
    },

    reaction: {
        bg: "#efefef",
        txt: "#191919",
    },

    timeline: {
        txt: "rgba(255,255,255,0.9)",
        bg: "transparent",
    },

    toast: {
        failure: {
            bg: "#c71f1f",
            txt: "#ffffff",
        },
        success: {
            bg: "limegreen",
            txt: "#ffffff",
        },
    },

    section: {
        bg: "white",
        txt: "#191919",
        bd: "transparent",
    },

    "sub-section": {
        bg: "#ffffff",
    },

    input: {
        bg: "#ffffff",
        txt: "#191919",
        bd: "#dddddd",
    },

    participants: {
        bg: "#efefef",
        txt: "#191919",
        hv: "#e2e2e2",
        bd: "transparent",
    },

    entry: {
        bg: "#efefef",
        bd: "#dddddd",
        input: {
            bg: "#ffffff",
            txt: "#191919",
        },
    },

    panel: {
        bg: "linear-gradient(#22A7F2, #5f2583)",
        left: {
            bg: "rgba(255,255,255,0.15)",
        },
    },

    currentUser: {
        bd: "transparent",
        bg: "white",
        txt: "#191919",
        ic: "#aaa",
    },

    avatar: {
        bg: "rgba(255, 255, 255,25%)",
        bd: "#cccccc",
        sh: "2px 2px 4px #e2e2e2",
    },

    chatSearch: {
        bg: "#ffffff",
        txt: "#555555",
        bd: "#dddddd",

        section: {
            txt: "#ffffff",
        },
    },

    chatSummary: {
        bg: "white",
        hv: "#efefef",
        txt1: "#191919",
        txt2: "#777777",
        bd: "transparent",
        "bd-selected": "#f79031",
    },

    spinner: "#ffffff",

    menu: {
        bg: "white",
        txt: "#191919",
        "disabled-txt": "#999999",
        bd: "#cccccc",
        hv: "#efefef",
        sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
    },

    button: {
        bg: "#22A7F2",
        hv: "#52baf5",
        txt: "#ffffff",
        bd: "transparent",
        disabled: "#cccccc",
        spinner: "#ffffff",
        "disabled-txt": "#999999",
        "disabled-bd": "transparent",
    },

    link: {
        underline: "#22A7F2",
    },

    modal: {
        bg: "#ffffff",
        txt: "#191919",
        sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
        filter: "blur(5px)",
        header: {
            bg: "#ffffff",
            txt: "#191919",
            bd: "#dfdfdf",
        },
        footer: {
            bg: "#efefef",
            txt: "#191919",
            bd: "#dddddd",
        },
    },

    modalPage: {
        bg: "rgba(255, 255, 255, 0.5)",
        txt: "#191919",
        sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
        filter: "blur(10px)",
        bd: "1px inset rgba(255, 255, 255, 0.3)",
        "txt-sh": "1px 1px rgba(255, 255, 255, 0.2)",
    },

    currentChat: {
        header: {
            // bg: "#efefef",
            bg: "rgba(255,255,255,0.35)",
            txt: "#191919",
            bd: "transparent",
        },

        msgs: {
            bg: "transparent",
        },

        msg: {
            bg: "#ffffff",
            txt: "#191919",
            hv: "transparent",
            bd: "#cccccc",

            me: {
                bg: "#ff69b4",
                txt: "#ffffff",
                hv: "#ff4fa7",
                bd: "#ff69b4",
            },
        },
    },

    icon: {
        color: "#cccccc",
        hv: "#dddddd",
    },
};

export const themes: Themes = {
    light: defaultTheme,
    dark: {
        ...defaultTheme,
        name: "dark",
        label: "Dark",

        bg: darkBase,
        txt: dark60,
        error: "#CF6679",
        accent: "hotpink",

        notificationBar: {
            bg: "#f3722b",
            txt: "#ffffff",
        },

        reaction: {
            bg: dark25,
            txt: dark60,
        },

        timeline: {
            txt: "rgba(255,255,255,0.7)",
            bg: "transparent",
        },

        toast: {
            failure: {
                bg: "darkred",
                txt: "#ffffff",
            },
            success: {
                bg: "seagreen",
                txt: "#ffffff",
            },
        },

        section: {
            bg: dark20,
            txt: dark60,
            bd: dark15,
        },

        "sub-section": {
            bg: dark25,
        },

        input: {
            bg: "#555555",
            txt: dark60,
            bd: dark15,
        },

        participants: {
            bg: dark20,
            txt: dark60,
            hv: dark15,
            bd: dark15,
        },

        entry: {
            bg: dark20,
            bd: dark15,
            input: {
                bg: "#555555",
                txt: dark60,
            },
        },

        panel: {
            bg: dark05,
            left: {
                bg: "rgba(0,0,0,0.1)",
            },
        },

        currentUser: {
            bd: dark15,
            bg: dark20,
            txt: dark60,
            ic: dark60,
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            bd: dark25,
            sh: "none",
        },

        chatSearch: {
            bg: "#555555",
            txt: dark60,
            bd: dark15,

            section: {
                txt: dark60,
            },
        },

        chatSummary: {
            bg: dark20,
            hv: dark15,
            txt1: dark60,
            txt2: "#888888",
            bd: dark10,
            "bd-selected": "#085d8c",
        },

        menu: {
            bg: dark15,
            txt: dark60,
            "disabled-txt": dark45,
            bd: dark20,
            hv: "#424242",
            sh: "-10px 10px 10px 0px rgba(8,93,140,0.3)",
        },

        button: {
            bg: "#085d8c",
            hv: "#053d5c",
            txt: "#ffffff",
            bd: "transparent",
            disabled: dark20,
            spinner: dark60,
            "disabled-txt": "#999999",
            "disabled-bd": "#999999",
        },

        link: {
            underline: "#085d8c",
        },

        modal: {
            bg: dark20,
            txt: dark60,
            sh: "0px 0px 0px 10px rgba(8,93,140,0.4)",
            filter: "blur(5px)",
            header: {
                bg: dark20,
                txt: dark60,
                bd: dark15,
            },
            footer: {
                bg: dark20,
                txt: dark60,
                bd: dark15,
            },
        },

        modalPage: {
            bg: "rgba(0, 0, 0, 0.4)",
            txt: dark60,
            sh: "none",
            filter: "blur(10px)",
            bd: "1px inset rgba(255, 255, 255, 0.1)",
            "txt-sh": "1px 1px rgba(0, 0, 0, 0.2)",
        },

        currentChat: {
            header: {
                bg: dark20,
                txt: dark60,
                bd: dark15,
            },
            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: dark20,
                txt: dark60,
                hv: dark10,
                bd: dark15,

                me: {
                    bg: "#820041",
                    txt: dark60,
                    hv: "#680034",
                    bd: "#820041",
                },
            },
        },

        icon: {
            color: dark25,
            hv: dark25,
        },
        spinner: dark25,
    },
};

function writeCssVars(prefix: string, section: Theme): void {
    for (const [comp, props] of Object.entries(section)) {
        if (typeof props === "string") {
            const varStr = `${prefix}${comp}`;
            document.documentElement.style.setProperty(varStr, props);
        } else if (typeof props === "object" && props) {
            writeCssVars(`${prefix}${comp}-`, props);
        }
    }
}

function osDark(): boolean {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    return prefersDarkScheme.matches;
}

function themeByName(name: string | null): Theme {
    if (!name) return themes.light;

    if (name === "system") {
        return osDark() ? themes.dark : themes.light;
    }

    return themes[name as keyof Themes] ?? themes.light;
}

export function getCurrentThemeName(): string {
    return localStorage.getItem("openchat_theme") ?? "light";
}

export function loadAndApplySavedTheme(): string {
    const themeName = localStorage.getItem("openchat_theme");
    const theme = themeByName(themeName);
    writeCssVars("--", theme);
    return themeName ?? "light";
}

export function saveSeletedTheme(themeName: string): void {
    const theme = themeByName(themeName);
    writeCssVars("--", theme);
    localStorage.setItem("openchat_theme", themeName);
}
