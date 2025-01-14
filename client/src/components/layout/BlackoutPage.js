import React from "react";

export class BlackoutPage extends React.Component {
    render() {
        return (
            <div className="flex flex-col space-y-4 min-w-screen h-screen animated fadeIn faster fixed  left-0 top-0 flex justify-center items-center inset-0 z-40 outline-none focus:outline-none" style={{background: "#242424"}}>
                {this.props.children}
            </div>
        );
    }
}